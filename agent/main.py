from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import logging
from dotenv import load_dotenv
import psycopg2
import numpy as np
import json
from datetime import datetime, timedelta
from haystack import Pipeline
from haystack.dataclasses import Document, ChatMessage
from haystack.components.retrievers.in_memory import InMemoryEmbeddingRetriever
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.components.builders import ChatPromptBuilder
from haystack.components.generators.chat import OpenAIChatGenerator
from openai import OpenAI
import traceback

from langfuse import Langfuse
from langfuse.openai import openai
from langfuse.decorators import observe, langfuse_context

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

langfuse = Langfuse(public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                    secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                    host=os.getenv("LANGFUSE_HOST"))

# Initialize FastAPI app
app = FastAPI(title="RAG Pipeline API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection parameters
DB_URL = os.getenv("DATABASE_URL")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
EMBEDDER_MODEL = os.getenv("EMBEDDER_MODEL", "text-embedding-3-small")
MAX_CHUNKS = int(os.getenv("MAX_CHUNKS", "20"))

# Initialize document store
document_store = InMemoryDocumentStore(embedding_similarity_function="cosine")

# Initialize OpenAI client
# openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Database connection function


def get_db_connection():
    try:
        conn = psycopg2.connect(DB_URL)
        return conn
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Database connection error: {str(e)}")


# Function to load documents from database
def load_documents_from_db(user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        logger.info("Loading documents from database...")

        # Query to get document pages with content and embeddings
        query = """
            SELECT dp.id, dp.document_id, dp.user_id, dp.page_number, 
                   dp.page_content, dp.page_embeddings, d.title
            FROM document_pages dp
            JOIN documents d ON dp.document_id = d.id
            WHERE dp.page_content IS NOT NULL AND dp.page_embeddings IS NOT NULL
        """

        # Add user_id filter if provided
        if user_id:
            query += f" AND dp.user_id = '{user_id}'"
            logger.info(f"Filtering documents for user_id: {user_id}")

        cursor.execute(query)

        rows = cursor.fetchall()
        documents = []

        logger.info(
            f"Found {len(rows)} document pages with content and embeddings")

        for row in rows:
            doc_id, document_id, user_id, page_number, content, embeddings, title = row

            # Create Document object without embeddings for now
            # We'll handle embeddings separately during retrieval
            doc = Document(
                content=content,
                meta={
                    "id": doc_id,
                    "document_id": document_id,
                    "user_id": user_id,
                    "page_number": page_number,
                    "title": title,
                    "raw_embeddings": embeddings,  # Store raw embeddings in meta
                    "source_type": "document"
                }
            )
            documents.append(doc)

        logger.info(f"Successfully loaded {len(documents)} documents")
        return documents

    except Exception as e:
        logger.error(f"Error loading documents: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error loading documents: {str(e)}")
    finally:
        cursor.close()
        conn.close()


# Function to load emails from database
def load_emails_from_db(limit=500, user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        logger.info(f"Loading last {limit} emails from database...")

        # Query to get emails
        query = """
            SELECT id, user_id, mail_id, subject, from_name, from_email, 
                   received_datetime, body_preview, is_read, to_recipients, cc_recipients
            FROM outlook_mails
        """

        # Add user_id filter if provided
        if user_id:
            query += f" WHERE user_id = '{user_id}'"
            logger.info(f"Filtering emails for user_id: {user_id}")

        # Add order by and limit
        query += f" ORDER BY received_datetime DESC LIMIT {limit}"

        cursor.execute(query)

        rows = cursor.fetchall()
        emails = []

        logger.info(f"Found {len(rows)} emails")

        for row in rows:
            id, user_id, mail_id, subject, from_name, from_email, received_datetime, body_preview, is_read, to_recipients, cc_recipients = row

            # Format email content
            email_content = f"""
Email Subject: {subject}
From: {from_name} <{from_email}>
Date: {received_datetime}
To: {to_recipients}
CC: {cc_recipients or ''}
Preview: {body_preview or ''}
            """

            # Parse received_datetime to a standard format if it's a string
            received_date_str = received_datetime
            if isinstance(received_datetime, datetime):
                received_date_str = received_datetime.isoformat()

            # Create Document object
            doc = Document(
                content=email_content.strip(),
                meta={
                    "id": id,
                    "user_id": user_id,
                    "mail_id": mail_id,
                    "subject": subject,
                    "from_name": from_name,
                    "from_email": from_email,
                    "received_datetime": received_date_str,
                    "is_read": is_read,
                    "source_type": "email"
                }
            )
            emails.append(doc)

        logger.info(f"Successfully loaded {len(emails)} emails")
        return emails

    except Exception as e:
        logger.error(f"Error loading emails: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error loading emails: {str(e)}")
    finally:
        cursor.close()
        conn.close()


# Function to load calendar events from database
def load_calendar_events_from_db(limit=50, user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        logger.info(f"Loading last {limit} calendar events from database...")

        # Query to get calendar events
        query = """
            SELECT id, user_id, event_id, subject, body_preview, 
                   start_datetime, end_datetime, start_timezone, end_timezone, attendees
            FROM outlook_events
        """

        # Add user_id filter if provided
        if user_id:
            query += f" WHERE user_id = '{user_id}'"
            logger.info(f"Filtering calendar events for user_id: {user_id}")

        # Add order by and limit
        query += f" ORDER BY start_datetime DESC LIMIT {limit}"

        cursor.execute(query)

        rows = cursor.fetchall()
        events = []

        logger.info(f"Found {len(rows)} calendar events")

        for row in rows:
            id, user_id, event_id, subject, body_preview, start_datetime, end_datetime, start_timezone, end_timezone, attendees = row

            # Format event content
            event_content = f"""
Event: {subject}
Start: {start_datetime} ({start_timezone or 'Unknown timezone'})
End: {end_datetime} ({end_timezone or 'Unknown timezone'})
Attendees: {attendees or 'None'}
Description: {body_preview or ''}
            """

            # Create Document object
            doc = Document(
                content=event_content.strip(),
                meta={
                    "id": id,
                    "user_id": user_id,
                    "event_id": event_id,
                    "subject": subject,
                    "start_datetime": start_datetime.isoformat() if isinstance(start_datetime, datetime) else start_datetime,
                    "end_datetime": end_datetime.isoformat() if isinstance(end_datetime, datetime) else end_datetime,
                    "source_type": "calendar_event"
                }
            )
            events.append(doc)

        logger.info(f"Successfully loaded {len(events)} calendar events")
        return events

    except Exception as e:
        logger.error(f"Error loading calendar events: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error loading calendar events: {str(e)}")
    finally:
        cursor.close()
        conn.close()


# Function to load next week events from database
def load_next_week_events_from_db(user_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        logger.info("Loading all next week events from database...")

        # Query to get next week events
        query = """
            SELECT id, user_id, event_id, subject, body_preview, 
                   start_datetime, end_datetime, start_timezone, end_timezone, attendees
            FROM outlook_next_week_events
        """

        # Add user_id filter if provided
        if user_id:
            query += f" WHERE user_id = '{user_id}'"
            logger.info(f"Filtering next week events for user_id: {user_id}")

        cursor.execute(query)

        rows = cursor.fetchall()
        events = []

        logger.info(f"Found {len(rows)} next week events")

        for row in rows:
            id, user_id, event_id, subject, body_preview, start_datetime, end_datetime, start_timezone, end_timezone, attendees = row

            # Format event content
            event_content = f"""
Upcoming Event: {subject}
Start: {start_datetime} ({start_timezone or 'Unknown timezone'})
End: {end_datetime} ({end_timezone or 'Unknown timezone'})
Attendees: {attendees or 'None'}
Description: {body_preview or ''}
            """

            # Create Document object
            doc = Document(
                content=event_content.strip(),
                meta={
                    "id": id,
                    "user_id": user_id,
                    "event_id": event_id,
                    "subject": subject,
                    "start_datetime": start_datetime.isoformat() if isinstance(start_datetime, datetime) else start_datetime,
                    "end_datetime": end_datetime.isoformat() if isinstance(end_datetime, datetime) else end_datetime,
                    "source_type": "next_week_event"
                }
            )
            events.append(doc)

        logger.info(f"Successfully loaded {len(events)} next week events")
        return events

    except Exception as e:
        logger.error(f"Error loading next week events: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error loading next week events: {str(e)}")
    finally:
        cursor.close()
        conn.close()


# Global variables
documents = []
document_store = None
user_id = None
# Add conversation store to maintain history per user
conversation_store = {}  # user_id -> List[ChatMessage]


# Helper function to call the LLM
@observe()
def call_llm(prompt, temperature=0.3, max_tokens=4096):
    """
    Helper function to call the LLM with standardized parameters
    """
    try:
        response = openai.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error calling LLM: {str(e)}")
        return "ERROR: Unable to generate response due to an error."


# Function to generate embeddings for documents
@observe()
def generate_embeddings(documents):
    global user_id
    logger.info(f"Generating embeddings for {len(documents)} documents...")

    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["generate_doc_embeddings"]
    )

    try:
        # Process in batches to avoid API limits
        batch_size = 20
        processed_docs = []

        for i in range(0, len(documents), batch_size):
            batch = documents[i:i+batch_size]
            batch_texts = [doc.content for doc in batch]

            # Generate embeddings using OpenAI
            response = openai.embeddings.create(
                input=batch_texts,
                model=EMBEDDER_MODEL
            )

            # Assign embeddings to documents
            for j, doc in enumerate(batch):
                doc.embedding = response.data[j].embedding
                processed_docs.append(doc)

            logger.info(
                f"Processed batch {i//batch_size + 1}/{(len(documents)-1)//batch_size + 1}")

        return processed_docs

    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise


# Request and response models
class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class QueryRequest(BaseModel):
    query: str
    top_k: Optional[int] = MAX_CHUNKS
    filter_by: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None
    conversation_history: Optional[List[ChatMessage]] = None


class DocumentResponse(BaseModel):
    id: Optional[str] = None
    document_id: Optional[str] = None
    title: Optional[str] = None
    content: str
    page_number: Optional[int] = None
    source_type: Optional[str] = None


class QueryResponse(BaseModel):
    answer: str
    documents: List[DocumentResponse]


@app.on_event("startup")
async def startup_event():
    global documents
    try:
        logger.info("Starting up the application...")
        logger.info("Application startup completed successfully")
    except Exception as e:
        logger.error(f"Error during startup: {str(e)}")


@app.post("/load_user_data")
async def load_user_data(request: dict):
    input_user_id = request.get("user_id")
    if not input_user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    global documents, user_id
    user_id = input_user_id

    # Update Langfuse context with the new user_id
    langfuse_context.update_current_trace(
        user_id=user_id
    )

    try:
        logger.info(f"Loading data for user: {user_id}")

        # Clear existing documents from the document store
        # The delete_documents method requires document_ids, so we'll create a new document store instead
        global document_store
        document_store = InMemoryDocumentStore(
            embedding_similarity_function="cosine")
        documents = []

        # Load documents, emails, and events with user_id filtering
        doc_documents = load_documents_from_db(user_id=user_id)
        email_documents = load_emails_from_db(
            200, user_id=user_id)  # Last 200 emails
        calendar_documents = load_calendar_events_from_db(
            50, user_id=user_id)  # Last 50 calendar events
        next_week_documents = load_next_week_events_from_db(
            user_id=user_id)  # All next week events

        # Combine all documents
        all_documents = doc_documents + email_documents + \
            calendar_documents + next_week_documents
        logger.info(f"Total documents loaded: {len(all_documents)}")

        # Process document embeddings
        processed_docs = []

        # First process documents that already have embeddings
        for doc in doc_documents:
            raw_embeddings = doc.meta.get("raw_embeddings")
            if raw_embeddings:
                if isinstance(raw_embeddings, str):
                    try:
                        embedding_array = np.fromstring(
                            raw_embeddings.strip("[]"), sep=",", dtype=float
                        )
                        doc.embedding = embedding_array
                        processed_docs.append(doc)
                    except Exception as e:
                        logger.warning(f"Could not parse embedding: {str(e)}")

        # Generate embeddings for emails and events
        docs_needing_embeddings = email_documents + \
            calendar_documents + next_week_documents
        if docs_needing_embeddings:
            embedded_docs = generate_embeddings(docs_needing_embeddings)
            processed_docs.extend(embedded_docs)

        # Write all documents to the document store
        document_store.write_documents(processed_docs)
        documents = processed_docs

        logger.info(
            f"Successfully indexed {len(processed_docs)} documents in the document store")

        return {
            "status": "success",
            "message": f"Successfully loaded and indexed {len(processed_docs)} documents for user {user_id}",
            "document_count": len(processed_docs),
            "document_types": {
                "documents": len(doc_documents),
                "emails": len(email_documents),
                "calendar_events": len(calendar_documents),
                "next_week_events": len(next_week_documents)
            }
        }
    except Exception as e:
        logger.error(f"Error loading user data: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error loading user data: {str(e)}")


# Function to generate query embeddings
@observe()
def generate_query_embeddings(query_text):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["generate_query_embeddings"]
    )

    logger.info(f"Generating embeddings for query: {query_text}")

    # Get embeddings for the query using OpenAI
    embedding_response = openai.embeddings.create(
        input=query_text,
        model=EMBEDDER_MODEL
    )
    # The embedding is already a list of floats from OpenAI
    return embedding_response.data[0].embedding


# Function to retrieve relevant documents
@observe()
def retrieve_documents(query_embedding, top_k=MAX_CHUNKS):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["retrieve_documents"]
    )

    # Create a retriever for this specific query
    retriever = InMemoryEmbeddingRetriever(document_store=document_store)

    # Run retrieval directly with the list of floats
    retrieval_result = retriever.run(
        query_embedding=query_embedding,
        top_k=top_k
    )
    retrieved_docs = retrieval_result["documents"]

    logger.info(f"Retrieved {len(retrieved_docs)} documents")
    return retrieved_docs


# Function to check if query is relevant to our domain
@observe()
def check_query_relevance(query_text, effective_user_id):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["check_query_relevance"]
    )

    # Create a prompt to check relevance
    domain_check_prompt = """
    I have access to the following types of information:
    1. Documents related to the current user (user_id: {user_id}), containing professional background, skills, education, and contact information
    2. Emails with subjects, senders, recipients, and content previews
    3. Calendar events with subjects, dates, times, and attendees
    4. Upcoming events scheduled for next week
    
    Given this context, determine if the following question is relevant to any of these domains:
    
    Question: {question}
    
    Respond with ONLY "YES" if the question is relevant to any of the available information, or "NO" if it's completely unrelated.
    """

    # Check if the query is relevant to our document domain
    relevance_check = openai.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": domain_check_prompt.format(
                question=query_text, user_id=effective_user_id or "current user")}
        ],
        temperature=0.1,
    )

    is_relevant = "YES" in relevance_check.choices[0].message.content
    logger.info(f"Domain relevance check: {is_relevant}")
    return is_relevant


# Function to analyze query and extract key information
@observe()
def analyze_query(query_text):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["analyze_query"]
    )

    # Pre-process the query to extract key information
    query_analysis_prompt = """
    Analyze the following query and extract key information:
    
    Query: {question}
    
    Extract the following information (if present):
    1. Specific person names mentioned (e.g., sender or recipient names)
    2. Time periods mentioned (e.g., "last week", "yesterday", "next month")
    3. Email or event specific terms (e.g., "meeting", "email", "calendar")
    4. Any other specific filters or criteria mentioned
    
    Format your response as a structured JSON with these fields (include empty strings if information is not present):
    {{
        "person_names": ["name1", "name2"],
        "time_period": "time period mentioned",
        "content_type": "email/event/document/etc",
        "other_criteria": "any other specific criteria"
    }}
    """

    # Analyze the query to extract key information
    query_analysis = openai.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": query_analysis_prompt.format(
                question=query_text)}
        ],
        temperature=0.1,
        response_format={"type": "json_object"}
    )

    try:
        query_info = json.loads(query_analysis.choices[0].message.content)
        logger.info(f"Query analysis: {query_info}")
        return query_info
    except Exception as e:
        logger.warning(f"Failed to parse query analysis: {str(e)}")
        return {"person_names": [], "time_period": "", "content_type": "", "other_criteria": ""}


# Function to filter documents based on query analysis
@observe()
def filter_documents(retrieved_docs, query_info):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["filter_documents"]
    )

    filtered_docs = []

    # Get current date for time-based filtering
    current_date = datetime.now()

    # Calculate date ranges for common time periods
    date_ranges = {
        "last week": (current_date - timedelta(days=7), current_date),
        "yesterday": (current_date - timedelta(days=1), current_date),
        "today": (current_date.replace(hour=0, minute=0, second=0), current_date),
        "this week": (current_date - timedelta(days=current_date.weekday()), current_date),
        "last month": (current_date - timedelta(days=30), current_date),
    }

    # Apply pre-filtering based on query analysis
    for doc in retrieved_docs:
        source_type = doc.meta.get("source_type", "unknown")

        # For email queries with person names
        if query_info.get("content_type") == "email" and query_info.get("person_names"):
            if source_type != "email":
                continue

            # Check if the email is from any of the mentioned people
            from_name = doc.meta.get("from_name", "").lower()
            from_email = doc.meta.get("from_email", "").lower()
            to_name = doc.meta.get("to_name", "").lower()
            to_email = doc.meta.get("to_email", "").lower()

            person_match = False
            for person in query_info.get("person_names", []):
                person_lower = person.lower()
                # Check both sender and recipient fields
                if (person_lower in from_name or
                    person_lower in from_email or
                    person_lower in to_name or
                        person_lower in to_email):
                    person_match = True
                    break

            if not person_match:
                continue

            # Check time period if specified
            time_period = query_info.get("time_period", "").lower()
            if time_period in date_ranges:
                received_date_str = doc.meta.get("received_datetime", "")
                if received_date_str:
                    try:
                        # Try to parse the date string
                        if isinstance(received_date_str, str):
                            # Handle different date formats
                            if 'T' in received_date_str:
                                received_date = datetime.fromisoformat(
                                    received_date_str.split('+')[0])
                            else:
                                # Try common formats
                                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                                    try:
                                        received_date = datetime.strptime(
                                            received_date_str, fmt)
                                        break
                                    except ValueError:
                                        continue
                        else:
                            received_date = received_date_str

                        start_date, end_date = date_ranges[time_period]
                        if not (start_date <= received_date <= end_date):
                            continue
                    except Exception as e:
                        logger.warning(f"Error parsing email date: {str(e)}")
                        continue

        # For calendar/event queries
        elif query_info.get("content_type") in ["calendar", "event"]:
            if source_type != "calendar" and source_type != "event":
                continue

            # Check time period if specified
            time_period = query_info.get("time_period", "").lower()
            if time_period:
                event_date_str = doc.meta.get("start_datetime", "")
                if not event_date_str:
                    continue

                try:
                    # Try to parse the date string
                    if isinstance(event_date_str, str):
                        # Handle different date formats
                        if 'T' in event_date_str:
                            event_date = datetime.fromisoformat(
                                event_date_str.split('+')[0])
                        else:
                            # Try common formats
                            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                                try:
                                    event_date = datetime.strptime(
                                        event_date_str, fmt)
                                    break
                                except ValueError:
                                    continue
                    else:
                        event_date = event_date_str

                    if time_period in date_ranges:
                        start_date, end_date = date_ranges[time_period]
                        if not (start_date <= event_date <= end_date):
                            continue
                except Exception as e:
                    logger.warning(f"Error parsing event date: {str(e)}")
                    continue

        # Add document to filtered list
        filtered_docs.append(doc)

    if filtered_docs:
        logger.info(
            f"Pre-filtered to {len(filtered_docs)} documents based on query analysis")
    else:
        logger.info(
            "No documents matched pre-filtering criteria, using all retrieved documents")
        filtered_docs = retrieved_docs

    return filtered_docs


# Function to format context from documents
@observe()
def format_context(context_docs):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["format_context"]
    )

    # Format the context from retrieved documents
    context_parts = []
    for i, doc in enumerate(context_docs):
        source_type = doc.meta.get("source_type", "unknown")
        # Add more metadata for emails
        if source_type == "email":
            from_name = doc.meta.get("from_name", "Unknown")
            from_email = doc.meta.get("from_email", "Unknown")
            to_name = doc.meta.get("to_name", "Unknown")
            to_email = doc.meta.get("to_email", "Unknown")
            received_date = doc.meta.get(
                "received_datetime", "Unknown date")
            subject = doc.meta.get("subject", "No subject")

            # Try to format the date in a more readable way
            try:
                if isinstance(received_date, str):
                    if 'T' in received_date:
                        date_obj = datetime.fromisoformat(
                            received_date.split('+')[0])
                        received_date = date_obj.strftime(
                            "%B %d, %Y at %I:%M %p")
                    else:
                        # Try common formats
                        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                            try:
                                date_obj = datetime.strptime(
                                    received_date, fmt)
                                received_date = date_obj.strftime(
                                    "%B %d, %Y at %I:%M %p")
                                break
                            except ValueError:
                                continue
            except Exception:
                # If date formatting fails, use the original string
                pass

            context_parts.append(
                f"[EMAIL {i+1}]\nFrom: {from_name} <{from_email}>\nTo: {to_name} <{to_email}>\nDate: {received_date}\nSubject: {subject}\nContent: {doc.content}")

        # Add more metadata for calendar events
        elif source_type == "calendar" or source_type == "event":
            event_title = doc.meta.get("subject", "Untitled Event")
            start_time = doc.meta.get("start_datetime", "Unknown time")
            end_time = doc.meta.get("end_datetime", "Unknown time")
            location = doc.meta.get("location", "No location specified")
            attendees = doc.meta.get("attendees", "No attendees specified")

            # Try to format the dates in a more readable way
            try:
                if isinstance(start_time, str):
                    if 'T' in start_time:
                        date_obj = datetime.fromisoformat(
                            start_time.split('+')[0])
                        start_time = date_obj.strftime(
                            "%B %d, %Y at %I:%M %p")
                    else:
                        # Try common formats
                        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                            try:
                                date_obj = datetime.strptime(
                                    start_time, fmt)
                                start_time = date_obj.strftime(
                                    "%B %d, %Y at %I:%M %p")
                                break
                            except ValueError:
                                continue
            except Exception:
                # If date formatting fails, use the original string
                pass

            try:
                if isinstance(end_time, str):
                    if 'T' in end_time:
                        date_obj = datetime.fromisoformat(
                            end_time.split('+')[0])
                        end_time = date_obj.strftime(
                            "%B %d, %Y at %I:%M %p")
                    else:
                        # Try common formats
                        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                            try:
                                date_obj = datetime.strptime(end_time, fmt)
                                end_time = date_obj.strftime(
                                    "%B %d, %Y at %I:%M %p")
                                break
                            except ValueError:
                                continue
            except Exception:
                # If date formatting fails, use the original string
                pass

            context_parts.append(
                f"[EVENT {i+1}]\nTitle: {event_title}\nStart: {start_time}\nEnd: {end_time}\nLocation: {location}\nAttendees: {attendees}\nDetails: {doc.content}")
        else:
            context_parts.append(
                f"[{source_type.upper()} {i+1}]\n{doc.content}")

    context = "\n\n".join(context_parts)
    return context


# Function to extract information from context
@observe()
def extract_information(context, query_text, query_info, effective_user_id, conversation_history=None):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["extract_information_from_context"]
    )

    # Format conversation history if provided
    conversation_context = ""
    if conversation_history and len(conversation_history) > 0:
        conversation_context = """
Conversation history:
"""
        # Format the conversation history in a clear way
        # Use last 6 messages for context
        for i, msg in enumerate(conversation_history[-6:]):
            role = "User" if msg.role == "user" else "Assistant"
            conversation_context += f"{role}: {msg.content}\n"

        conversation_context += "\nCurrent query is a continuation of this conversation. Use the history to provide context-aware responses."

    # Create extraction prompt
    extraction_prompt = """
You are a helpful assistant with access to a user's emails, calendar events, and documents.

Your task is to extract relevant information from the provided context to answer the user's question.

{conversation_context}

Context:
{context}

User's Question:
{question}

Additional Information:
- Person names mentioned: {person_names}
- Time period mentioned: {time_period}
- Content type mentioned: {content_type}
- Other criteria: {other_criteria}
- User ID: {user_id}

Instructions:
1. Carefully analyze both the conversation history and context to find information relevant to the question
2. Consider previous questions and answers when interpreting the current question
3. If the question refers to previous messages (using pronouns like "it", "that", "they", etc.), resolve these references using the conversation history
4. If the question is a greeting (like "hi", "hello", etc.), respond with: GREETING
5. If the question is a thank you message, respond with: THANKS
6. If you find ANY relevant information (explicit or implicit), respond with:
FOUND: [your extracted answer with complete, well-organized details]

If you cannot find any relevant information even after careful analysis, respond with:
NOT_FOUND
"""

    # Format the prompt with the provided information
    formatted_prompt = extraction_prompt.format(
        conversation_context=conversation_context,
        context=context,
        question=query_text,
        person_names=query_info.get('person_names', 'None specified'),
        time_period=query_info.get('time_period', 'None specified'),
        content_type=query_info.get('content_type', 'None specified'),
        other_criteria=query_info.get('other_criteria', 'None specified'),
        user_id=effective_user_id or 'Not provided'
    )

    logger.info(f"Extraction prompt length: {len(formatted_prompt)}")

    # Call LLM to extract information
    extraction_result = call_llm(formatted_prompt)
    logger.info(f"Information extraction result: {extraction_result[:100]}...")
    return extraction_result


# Function to format final answer
@observe()
def format_final_answer(extraction_result, query_text, query_info, context_docs, conversation_history=None):
    global user_id
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["final_answer"]
    )

    # Format conversation history if provided
    conversation_context = ""
    if conversation_history and len(conversation_history) > 0:
        conversation_context = """
Previous conversation context:
"""
        # Use last 5 messages for context
        for msg in conversation_history[-5:]:
            role = "User" if msg.role == "user" else "Assistant"
            conversation_context += f"{role}: {msg.content}\n"

        conversation_context += "\nMaintain conversational continuity with your response."

    # Handle greeting messages
    if extraction_result.startswith("GREETING"):
        greeting_responses = [
            "Hello! How can I help you today?",
            "Hi there! What can I assist you with?",
            "Greetings! How may I be of service?",
            "Hey! I'm here to help. What do you need?"
        ]
        import random
        answer = random.choice(greeting_responses)
        return answer, []

    # Handle thank you messages
    if extraction_result.startswith("THANKS"):
        thank_responses = [
            "You're welcome! Is there anything else I can help you with?",
            "Happy to help! Let me know if you need anything else.",
            "Anytime! Feel free to ask if you have more questions.",
            "No problem at all! I'm here if you need further assistance."
        ]
        import random
        answer = random.choice(thank_responses)
        return answer, []

    if extraction_result.startswith("FOUND:"):
        # We found information to answer the question
        # Remove "FOUND: " prefix
        extracted_answer = extraction_result[6:].strip()

        # Format the answer
        formatting_prompt = """
You are a helpful assistant providing information to a user based on their emails, calendar events, and documents.

{conversation_context}

The user asked: {question}

Based on the available information, here's what was found:
{extracted_answer}

Your task is to format this information into a clear, helpful, and conversational response. 
Follow these guidelines:
1. Be concise but thorough
2. Maintain a friendly, helpful tone
3. Organize information logically with appropriate formatting (bullet points, paragraphs, etc.)
4. If referring to dates or times, be specific
5. If the user's question refers to previous messages, make sure your response acknowledges this continuity
6. If appropriate, offer follow-up assistance

Format your response to be directly presented to the user.
"""

        # Format the prompt with the provided information
        formatted_prompt = formatting_prompt.format(
            conversation_context=conversation_context,
            question=query_text,
            extracted_answer=extracted_answer
        )

        logger.info(f"Formatting prompt length: {len(formatted_prompt)}")

        # Call LLM to format the answer
        answer = call_llm(formatted_prompt)

        # Return the formatted answer and the context documents
        return answer, context_docs
    else:
        # We couldn't find information to answer the question
        no_info_prompt = """
You are a helpful assistant providing information to a user based on their emails, calendar events, and documents.

{conversation_context}

The user asked: {question}

Unfortunately, you couldn't find specific information to answer this question in the available data.

Your task is to craft a helpful, honest response that:
1. Acknowledges that you don't have the specific information
2. Maintains a friendly, helpful tone
3. If possible, suggests alternative approaches or questions
4. If the question seems completely unrelated to the data you have access to, politely explain your limitations
5. If the user's question refers to previous messages, acknowledge this continuity

Format your response to be directly presented to the user.
"""

        # Format the prompt with the provided information
        formatted_prompt = no_info_prompt.format(
            conversation_context=conversation_context,
            question=query_text
        )

        logger.info(f"No info prompt length: {len(formatted_prompt)}")

        # Call LLM to format the answer
        answer = call_llm(formatted_prompt)

        # Return the formatted answer and empty context documents
        return answer, []


# Main query endpoint
@observe()
@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    global user_id, conversation_store
    langfuse_context.update_current_trace(
        user_id=user_id,
        tags=["query_endpoint"]
    )
    try:
        # Use the request user_id if provided, otherwise fall back to the global user_id
        effective_user_id = request.user_id or user_id

        logger.info(f"Processing User ID: {effective_user_id}")
        logger.info(f"Processing query: {request.query}")

        # Get conversation history from store or request
        conversation_history = []
        using_stored_history = False

        if effective_user_id and effective_user_id in conversation_store:
            conversation_history = conversation_store[effective_user_id]
            using_stored_history = True
            logger.info(
                f"Using stored conversation history for user {effective_user_id}. History length: {len(conversation_history)}")
        elif request.conversation_history:
            conversation_history = request.conversation_history
            logger.info(
                f"Using provided conversation history. History length: {len(conversation_history)}")
        else:
            logger.info("No conversation history available")

        # Step 1: Generate embeddings for the query
        query_embedding = generate_query_embeddings(request.query)

        # Step 2: Retrieve relevant documents
        retrieved_docs = retrieve_documents(query_embedding, request.top_k)

        # Check if we have any documents
        if not retrieved_docs:
            answer = "I don't have enough relevant information to answer this question. This question appears to be outside the scope of the context I have access to."
            # Update conversation store
            if effective_user_id:
                # Add user query to history
                conversation_history.append(ChatMessage(
                    role="user", content=request.query))
                # Add assistant response to history
                conversation_history.append(
                    ChatMessage(role="assistant", content=answer))
                # Limit history to last 10 messages
                conversation_store[effective_user_id] = conversation_history[-10:]
                logger.info(
                    f"Updated conversation store for user {effective_user_id}. New history length: {len(conversation_store[effective_user_id])}")

            return QueryResponse(
                answer=answer,
                documents=[]
            )

        # Step 3: Check if query is relevant to our domain
        is_relevant = check_query_relevance(request.query, effective_user_id)
        if not is_relevant:
            answer = "I don't have enough relevant information to answer this question. This question appears to be outside the scope of the documents I have access to."
            # Update conversation store
            if effective_user_id:
                # Add user query to history
                conversation_history.append(ChatMessage(
                    role="user", content=request.query))
                # Add assistant response to history
                conversation_history.append(
                    ChatMessage(role="assistant", content=answer))
                # Limit history to last 10 messages
                conversation_store[effective_user_id] = conversation_history[-10:]
                logger.info(
                    f"Updated conversation store for user {effective_user_id}. New history length: {len(conversation_store[effective_user_id])}")

            return QueryResponse(
                answer=answer,
                documents=[]
            )

        # Step 4: Analyze the query to extract key information
        query_info = analyze_query(request.query)
        logger.info(f"Query analysis: {query_info}")

        # Step 5: Filter documents based on query analysis
        filtered_docs = filter_documents(retrieved_docs, query_info)
        logger.info(
            f"Filtered documents: {len(filtered_docs)} (from {len(retrieved_docs)})")

        # Step 6: Format context from filtered documents
        context = format_context(filtered_docs)

        # Step 7: Extract information from context
        extraction_result = extract_information(
            context, request.query, query_info, effective_user_id, conversation_history)

        # Step 8: Format final answer
        answer, context_docs = format_final_answer(
            extraction_result, request.query, query_info, filtered_docs, conversation_history)

        # Update conversation store with the new interaction
        if effective_user_id:
            # Add user query to history
            conversation_history.append(ChatMessage(
                role="user", content=request.query))
            # Add assistant response to history
            conversation_history.append(
                ChatMessage(role="assistant", content=answer))
            # Limit history to last 10 messages
            conversation_store[effective_user_id] = conversation_history[-10:]
            logger.info(
                f"Updated conversation store for user {effective_user_id}. New history length: {len(conversation_store[effective_user_id])}")

        # Format documents for response
        docs_for_response = []
        for doc in context_docs:
            source_type = doc.meta.get("source_type", "unknown")
            docs_for_response.append(DocumentResponse(
                id=str(doc.meta.get("id", "")),
                document_id=str(doc.meta.get("document_id", "")),
                title=str(doc.meta.get("title", "")),
                content=doc.content,
                page_number=doc.meta.get("page_number"),
                source_type=source_type
            ))

        return QueryResponse(
            answer=answer,
            documents=docs_for_response
        )

    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Error processing query: {str(e)}")


@app.get("/health")
async def health_check():
    try:
        # Check database connection
        conn = get_db_connection()
        conn.close()

        # Check OpenAI API
        openai.models.list()

        # Use count_documents instead of get_all_documents
        doc_count = document_store.count_documents()

        # Count documents by source type
        doc_types = {}
        for doc in documents:
            source_type = doc.meta.get("source_type", "unknown")
            if source_type in doc_types:
                doc_types[source_type] += 1
            else:
                doc_types[source_type] = 1

        # Get default user_id information
        default_user_id = os.getenv("DEFAULT_USER_ID", "Not set")
        user_filtering = "Enabled" if default_user_id != "Not set" else "Disabled"

        return {
            "status": "healthy",
            "database": "connected",
            "openai_api": "connected",
            "document_count": doc_count,
            "document_types": doc_types,
            "user_filtering": user_filtering,
            "default_user_id": default_user_id if default_user_id != "Not set" else None
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

# Endpoint to get conversation history


@app.post("/conversation_history")
async def get_conversation_history(request: dict):
    global conversation_store

    user_id = request.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")

    # Check if we need to clear the conversation history
    if request.get("clear", False):
        if user_id in conversation_store:
            logger.info(f"Clearing conversation history for user {user_id}")
            del conversation_store[user_id]
        return {
            "conversation": [],
            "has_memory": False,
            "memory_length": 0,
            "memory_size_bytes": 0,
            "cleared": True
        }

    # Return conversation history for the user
    if user_id in conversation_store:
        history = conversation_store[user_id]
        logger.info(
            f"Retrieved conversation history for user {user_id}. History length: {len(history)}")
        return {
            "conversation": history,
            "has_memory": True,
            "memory_length": len(history),
            "memory_size_bytes": len(json.dumps(history))
        }
    else:
        logger.info(f"No conversation history found for user {user_id}")
        return {
            "conversation": [],
            "has_memory": False,
            "memory_length": 0,
            "memory_size_bytes": 0
        }
