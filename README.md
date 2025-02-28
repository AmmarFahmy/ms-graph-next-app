# Outlook Integration with RAG Pipeline

This project combines a Next.js frontend with a FastAPI backend to create an intelligent assistant that can access and process Microsoft Outlook data (emails, calendar events) and documents using a Retrieval-Augmented Generation (RAG) pipeline.

## Project Structure

- `app/` - Next.js frontend application
- `agent/` - FastAPI backend with RAG pipeline
- `scripts/` - Utility scripts for setup and maintenance
- `public/` - Static assets for the frontend

## Features

- **Next.js Frontend**:
  - Modern UI with Tailwind CSS
  - Microsoft Graph API integration for Outlook data
  - Document upload and processing
  - Chat interface with AI assistant
  - User authentication via Microsoft

- **FastAPI Backend**:
  - RAG pipeline using Haystack
  - Integration with NeonDB PostgreSQL database
  - User-based data filtering for privacy and security
  - OpenAI integration for embeddings and text generation
  - Health monitoring endpoints

## Setup and Installation

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- NeonDB PostgreSQL database
- OpenAI API key
- Microsoft Azure App registration for Graph API access

### Frontend Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_CLIENT_ID=your_azure_client_id
   NEXT_PUBLIC_AUTHORITY=https://login.microsoftonline.com/common
   NEXT_PUBLIC_REDIRECT_URI=http://localhost:3000
   NEXT_PUBLIC_GRAPH_ENDPOINT=https://graph.microsoft.com/v1.0
   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend Setup

1. Navigate to the agent directory:
   ```bash
   cd agent
   ```

2. Install dependencies:
   ```bash
   pip install -r ../requirements.txt
   ```

3. Set up environment variables in `agent/.env`:
   ```
   DATABASE_URL=your_neondb_connection_string
   OPENAI_API_KEY=your_openai_api_key
   LLM_MODEL=gpt-4o
   EMBEDDER_MODEL=text-embedding-3-small
   MAX_CHUNKS=10
   DEFAULT_USER_ID=your_default_user_id  # Important for user-based filtering
   ```

4. Start the backend server:
   ```bash
   cd ..
   python run.py
   ```

## Running the Application

**Important**: Always start the frontend before the backend to ensure proper initialization.

1. Start the frontend:
   ```bash
   npm run dev
   ```

2. Start the backend:
   ```bash
   python run.py
   ```

3. Access the application at http://localhost:3000

## User-Based Data Filtering

The backend implements user-based filtering to ensure data privacy and security:

- During initialization, the system only loads data for the specified user (if `DEFAULT_USER_ID` is set)
- During queries, results are filtered by user_id (if provided in the request)
- The system provides clear logging about user filtering status

To enable user-based filtering, set the `DEFAULT_USER_ID` environment variable to the ID of the user whose data should be loaded at startup.

## API Endpoints

### Query the RAG Pipeline

```
POST /query
```

Request body:
```json
{
  "query": "Your question here",
  "top_k": 5,
  "filter_by": {
    "user_id": "user_id_here"
  }
}
```

Response:
```json
{
  "answer": "Generated answer based on retrieved documents",
  "documents": [
    {
      "id": "document_id",
      "document_id": "parent_document_id",
      "title": "Document title",
      "content": "Document content",
      "page_number": 1,
      "source_type": "document|email|calendar_event|next_week_event"
    }
  ]
}
```

### Health Check

```
GET /health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "openai_api": "connected",
  "document_count": 100,
  "document_types": {
    "document": 50,
    "email": 30,
    "calendar_event": 15,
    "next_week_event": 5
  },
  "user_filtering": "Enabled",
  "default_user_id": "user_id_here"
}
```

## Database Schema

The application expects the following database schema:

- `documents` table:
  - `id`: Document ID
  - `user_id`: User ID
  - `title`: Document title
  - `file_name`: File name
  - `file_size`: File size
  - `file_type`: File type
  - `created_at`: Creation timestamp

- `document_pages` table:
  - `id`: Page ID
  - `document_id`: Document ID
  - `user_id`: User ID
  - `page_number`: Page number
  - `page_content`: Text content of the page
  - `page_embeddings`: Vector embeddings of the page content
  - `created_at`: Creation timestamp
  - `updated_at`: Update timestamp

- `outlook_mails` table:
  - `id`: Email ID
  - `user_id`: User ID
  - `mail_id`: Microsoft Graph API mail ID
  - `subject`: Email subject
  - `from_name`: Sender name
  - `from_email`: Sender email
  - `received_datetime`: Received date and time
  - `body_preview`: Email body preview
  - `is_read`: Read status
  - `to_recipients`: Recipients
  - `cc_recipients`: CC recipients

- `outlook_events` table:
  - `id`: Event ID
  - `user_id`: User ID
  - `event_id`: Microsoft Graph API event ID
  - `subject`: Event subject
  - `body_preview`: Event description preview
  - `start_datetime`: Start date and time
  - `end_datetime`: End date and time
  - `start_timezone`: Start timezone
  - `end_timezone`: End timezone
  - `attendees`: Event attendees

- `outlook_next_week_events` table:
  - Similar structure to `outlook_events` but specifically for upcoming events

## Troubleshooting

- If you encounter database connection issues, verify your NeonDB connection string
- For authentication issues, check your Azure App registration settings
- If the RAG pipeline returns unexpected results, verify that user filtering is properly configured
- For frontend issues, check browser console for errors and verify API endpoints are accessible 