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
   - Filter results by user_id if provided
   - Generate a response using OpenAI's LLM
   - Return the response and relevant documents to the frontend

## User-Based Filtering

The backend implements user-based filtering to ensure data privacy and security:

- During initialization, the system only loads data for the specified user (if `DEFAULT_USER_ID` is set)
- During queries, results are filtered by user_id (if provided in the request)
- The system provides clear logging about user filtering status

To enable user-based filtering, set the `DEFAULT_USER_ID` environment variable to the ID of the user whose data should be loaded at startup.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | NeonDB PostgreSQL connection string | - |
| OPENAI_API_KEY | OpenAI API key | - |
| LLM_MODEL | OpenAI model for text generation | gpt-4o |
| EMBEDDER_MODEL | OpenAI model for embeddings | text-embedding-3-small |
| MAX_CHUNKS | Maximum number of chunks to retrieve | 20 |
| DEFAULT_USER_ID | User ID for filtering data | - |

## API Endpoints

### Query Endpoint

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

## Running the Backend

From the project root directory:

```bash
python run.py
```

This will start the FastAPI server on http://localhost:8000 with auto-reload enabled.

## Testing

You can test the API using the provided test script:

```bash
python test_api.py
```

Or using curl:

```bash
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What emails did I receive yesterday?", "filter_by": {"user_id": "your_user_id"}}'
```

## Troubleshooting

- **Database Connection Issues**: Verify your NeonDB connection string in the .env file.
- **OpenAI API Issues**: Check your OpenAI API key and ensure you have sufficient credits.
- **Empty Results**: Verify that the database contains data for the specified user_id.
- **Slow Performance**: Consider reducing the MAX_CHUNKS value or optimizing database queries. 