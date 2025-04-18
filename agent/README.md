# FastAPI RAG Backend

This directory contains the FastAPI backend for the Outlook Integration project. It implements a Retrieval-Augmented Generation (RAG) pipeline using Haystack, OpenAI, and NeonDB.

## Architecture

The backend follows a modular architecture:

1. **FastAPI Application**: Provides REST API endpoints for querying the RAG pipeline and checking system health.
2. **Database Connection**: Connects to NeonDB PostgreSQL database to retrieve document content, emails, and calendar events.
3. **Document Processing**: Loads and processes documents, emails, and calendar events from the database.
4. **Embedding Generation**: Generates embeddings for documents that don't have pre-computed embeddings.
5. **RAG Pipeline**: Implements a retrieval-augmented generation pipeline using Haystack components.
6. **User-Based Filtering**: Ensures data privacy by filtering all operations by user_id.
7. **Langfuse Integration**: Provides observability and tracing for all LLM operations.
8. **Modular Query Processing**: Breaks down the query process into separate, observable functions.

### Architecture Diagram

```mermaid
flowchart TB
    subgraph "FastAPI Backend"
        API[FastAPI Application]
        RAG[RAG Pipeline]
        DB_Conn[Database Connection]
        Doc_Proc[Document Processing]
        Embed_Gen[Embedding Generation]
        User_Filter[User-Based Filtering]
        Lang_Obs[Langfuse Observability]
        Query_Proc[Modular Query Processing]
        
        API --> RAG
        API --> DB_Conn
        RAG --> Doc_Proc
        RAG --> Embed_Gen
        RAG --> User_Filter
        RAG --> Query_Proc
        Query_Proc --> Lang_Obs
    end
    
    subgraph "External Services"
        NeonDB[(NeonDB PostgreSQL)]
        OpenAI[OpenAI API]
        Langfuse[Langfuse]
    end
    
    subgraph "Frontend"
        Next[Next.js Frontend]
    end
    
    DB_Conn <--> NeonDB
    Embed_Gen <--> OpenAI
    RAG <--> OpenAI
    Lang_Obs <--> Langfuse
    Next <--> API
```

## Key Components

- `main.py`: Main FastAPI application with API endpoints and RAG pipeline implementation.
- `.env`: Environment variables for database connection, OpenAI API, and configuration.

## Data Flow

1. **Startup Process**:
   - Load documents, emails, and calendar events from the database
   - Filter data by user_id if DEFAULT_USER_ID is set
   - Process document embeddings
   - Index documents in the in-memory document store

2. **Query Process**:
   - Receive query from frontend
   - Generate embeddings for the query
   - Retrieve relevant documents based on embedding similarity
   - Check query relevance to available data
   - Analyze query to extract key information (people, time periods, etc.)
   - Filter documents based on query analysis
   - Format context from filtered documents
   - Extract information from context
   - Format final answer
   - Return the response and relevant documents to the frontend

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant Frontend
    participant FastAPI
    participant DB as NeonDB
    participant OpenAI
    participant Langfuse
    
    %% Startup Process
    Note over FastAPI: Startup Process
    FastAPI->>DB: Load documents, emails, events
    DB-->>FastAPI: Return data
    FastAPI->>FastAPI: Filter by user_id
    FastAPI->>OpenAI: Generate embeddings
    OpenAI-->>FastAPI: Return embeddings
    FastAPI->>FastAPI: Index documents
    
    %% Query Process
    Note over Frontend,FastAPI: Query Process
    Frontend->>FastAPI: POST /query
    
    FastAPI->>Langfuse: Start trace
    
    FastAPI->>OpenAI: Generate query embeddings
    OpenAI-->>FastAPI: Return embeddings
    
    FastAPI->>FastAPI: Retrieve documents
    
    FastAPI->>OpenAI: Check query relevance
    OpenAI-->>FastAPI: Relevance assessment
    
    FastAPI->>OpenAI: Analyze query
    OpenAI-->>FastAPI: Query analysis
    
    FastAPI->>FastAPI: Filter documents
    
    FastAPI->>FastAPI: Format context
    
    FastAPI->>OpenAI: Extract information
    OpenAI-->>FastAPI: Extracted information
    
    FastAPI->>OpenAI: Format final answer
    OpenAI-->>FastAPI: Final answer
    
    FastAPI->>Langfuse: End trace
    
    FastAPI-->>Frontend: Return response
```

## User-Based Filtering

The backend implements user-based filtering to ensure data privacy and security:

- During initialization, the system only loads data for the specified user (if `DEFAULT_USER_ID` is set)
- During queries, results are filtered by user_id (if provided in the request)
- The system provides clear logging about user filtering status

To enable user-based filtering, set the `DEFAULT_USER_ID` environment variable to the ID of the user whose data should be loaded at startup.

## Langfuse Observability

The backend integrates with Langfuse for comprehensive observability of all LLM operations:

- Each function in the query pipeline is decorated with `@observe()` for detailed tracing
- User context is passed to Langfuse for user-specific analytics
- Performance metrics are automatically collected for each step
- Error tracking is integrated throughout the pipeline

To enable Langfuse, set the following environment variables:
- `LANGFUSE_PUBLIC_KEY`: Your Langfuse public key
- `LANGFUSE_SECRET_KEY`: Your Langfuse secret key
- `LANGFUSE_HOST`: Your Langfuse host URL (default: https://cloud.langfuse.com)

### Langfuse Tracing Diagram

```mermaid
gantt
    title Langfuse Trace Example
    dateFormat  s
    axisFormat %S
    
    section Query Pipeline
    generate_query_embeddings    :a1, 0, 0.2s
    retrieve_documents           :a2, after a1, 0.3s
    check_query_relevance        :a3, after a2, 0.5s
    analyze_query                :a4, after a3, 0.7s
    filter_documents             :a5, after a4, 0.2s
    format_context               :a6, after a5, 0.3s
    extract_information          :a7, after a6, 0.8s
    format_final_answer          :a8, after a7, 0.6s
```

## Modular Query Pipeline

The query process is broken down into separate functions, each with its own observability:

1. `generate_query_embeddings`: Generates embeddings for the query text
2. `retrieve_documents`: Retrieves relevant documents using the query embedding
3. `check_query_relevance`: Checks if the query is relevant to the available data
4. `analyze_query`: Extracts key information from the query (people, time periods, etc.)
5. `filter_documents`: Filters documents based on the query analysis
6. `format_context`: Formats the context from the filtered documents
7. `extract_information`: Extracts relevant information from the context
8. `format_final_answer`: Formats the final answer based on the extracted information

This modular approach provides:
- Better error isolation and handling
- Detailed performance metrics for each step
- Improved code maintainability
- Easier debugging and testing

### Query Pipeline Diagram

```mermaid
flowchart TD
    Query[User Query] --> QEmbed[generate_query_embeddings]
    QEmbed --> Retrieve[retrieve_documents]
    Retrieve --> Relevance[check_query_relevance]
    Relevance -->|Relevant| Analyze[analyze_query]
    Relevance -->|Not Relevant| NoData[Return No Data Response]
    Analyze --> Filter[filter_documents]
    Filter --> Format[format_context]
    Format --> Extract[extract_information]
    Extract --> Final[format_final_answer]
    Final --> Response[Return Response]
    
    style QEmbed fill:#f9f,stroke:#333,stroke-width:2px
    style Retrieve fill:#bbf,stroke:#333,stroke-width:2px
    style Relevance fill:#f9f,stroke:#333,stroke-width:2px
    style Analyze fill:#f9f,stroke:#333,stroke-width:2px
    style Filter fill:#bbf,stroke:#333,stroke-width:2px
    style Format fill:#bbf,stroke:#333,stroke-width:2px
    style Extract fill:#f9f,stroke:#333,stroke-width:2px
    style Final fill:#f9f,stroke:#333,stroke-width:2px
    
    classDef llmNode fill:#f9f,stroke:#333,stroke-width:2px;
    classDef processingNode fill:#bbf,stroke:#333,stroke-width:2px;
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | NeonDB PostgreSQL connection string | - |
| OPENAI_API_KEY | OpenAI API key | - |
| LLM_MODEL | OpenAI model for text generation | gpt-4o |
| EMBEDDER_MODEL | OpenAI model for embeddings | text-embedding-3-small |
| MAX_CHUNKS | Maximum number of chunks to retrieve | 20 |
| DEFAULT_USER_ID | User ID for filtering data | - |
| LANGFUSE_PUBLIC_KEY | Langfuse public key | - |
| LANGFUSE_SECRET_KEY | Langfuse secret key | - |
| LANGFUSE_HOST | Langfuse host URL | https://cloud.langfuse.com |

## API Endpoints

### Load User Data Endpoint

```
POST /load_user_data
```

Request body:
```json
{
  "user_id": "user_email@example.com"
}
```

Response:
```json
{
  "status": "success",
  "message": "Successfully loaded and indexed X documents for user user_email@example.com",
  "document_count": 100,
  "document_types": {
    "documents": 10,
    "emails": 50,
    "calendar_events": 30,
    "next_week_events": 10
  }
}
```

### Query Endpoint

```
POST /query
```

Request body:
```json
{
  "query": "Your question here",
  "top_k": 5,
  "user_id": "user_email@example.com"
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

### Health Check Endpoint

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

### API Endpoints Diagram

```mermaid
classDiagram
    class FastAPIApplication {
        +GET /health
        +POST /query
        +POST /load_user_data
    }
    
    class HealthEndpoint {
        +check_database_connection()
        +check_openai_connection()
        +count_documents()
        +get_user_filtering_status()
    }
    
    class QueryEndpoint {
        +validate_request()
        +process_query()
        +format_response()
    }
    
    class LoadUserDataEndpoint {
        +validate_user_id()
        +load_user_data()
        +index_documents()
        +format_response()
    }
    
    FastAPIApplication --> HealthEndpoint
    FastAPIApplication --> QueryEndpoint
    FastAPIApplication --> LoadUserDataEndpoint
```

## Running the Backend

From the project root directory:

```bash
python run.py
```

This will start the FastAPI server on http://localhost:8000 with auto-reload enabled.

## Error Handling

The backend implements comprehensive error handling:

- Database connection errors are caught and reported
- OpenAI API errors are handled gracefully
- User input validation with clear error messages
- Detailed logging for all operations
- Structured error responses for API endpoints

### Error Handling Flow

```mermaid
flowchart TD
    Request[API Request] --> Validation{Input Validation}
    Validation -->|Valid| Processing[Process Request]
    Validation -->|Invalid| ValidationError[Return Validation Error]
    
    Processing --> DBConnection{DB Connection}
    DBConnection -->|Success| DBQuery[Query Database]
    DBConnection -->|Failure| DBError[Return DB Error]
    
    DBQuery --> OpenAICall{OpenAI API Call}
    OpenAICall -->|Success| GenerateResponse[Generate Response]
    OpenAICall -->|Failure| OpenAIError[Return OpenAI Error]
    
    GenerateResponse --> Response[Return Response]
    
    ValidationError --> Log[Log Error]
    DBError --> Log
    OpenAIError --> Log
    
    Log --> Langfuse[Send to Langfuse]
```

## Troubleshooting

- **Database Connection Issues**: Verify your NeonDB connection string in the .env file.
- **OpenAI API Issues**: Check your OpenAI API key and ensure you have sufficient credits.
- **Empty Results**: Verify that the database contains data for the specified user_id.
- **Slow Performance**: Consider reducing the MAX_CHUNKS value or optimizing database queries.
- **Langfuse Connection Issues**: Verify your Langfuse API keys and host URL. 