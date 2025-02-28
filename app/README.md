# Next.js Outlook Integration Frontend

This directory contains the Next.js frontend for the Outlook Integration project. It provides a modern web interface for interacting with Microsoft Outlook data and the RAG-powered AI assistant.

## Architecture

The frontend follows a component-based architecture:

1. **Next.js Application**: Provides the React framework and routing.
2. **Microsoft Authentication**: Handles user authentication with Microsoft identity.
3. **Microsoft Graph API**: Retrieves Outlook data (emails, calendar events).
4. **Backend API Integration**: Communicates with the FastAPI backend for RAG queries.
5. **UI Components**: Reusable components for the user interface.

## Key Components

- `page.tsx`: Main application page with layout and component composition.
- `components/`: Reusable UI components:
  - `Assistant.tsx`: Chat interface for interacting with the AI assistant.
  - `EmailList.tsx`: Display and management of emails.
  - `Calendar.tsx`: Display and management of calendar events.
  - `DocumentUpload.tsx`: Interface for uploading and managing documents.
- `utils/`: Utility functions for API calls, authentication, etc.
- `hooks/`: Custom React hooks for state management and API integration.
- `api/`: API route handlers for server-side operations.

## Data Flow

1. **Authentication Flow**:
   - User logs in with Microsoft credentials
   - Application receives authentication token
   - Token is used for Microsoft Graph API calls and backend authentication

2. **Data Retrieval Flow**:
   - Application fetches emails and calendar events from Microsoft Graph API
   - Data is displayed in the UI and synchronized to the backend database

3. **Query Flow**:
   - User enters a query in the Assistant component
   - Query is sent to the backend with the user's ID
   - Backend processes the query and returns a response
   - Response is displayed in the chat interface

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_CLIENT_ID | Azure App client ID | - |
| NEXT_PUBLIC_AUTHORITY | Microsoft identity authority URL | https://login.microsoftonline.com/common |
| NEXT_PUBLIC_REDIRECT_URI | Authentication redirect URI | http://localhost:3000 |
| NEXT_PUBLIC_GRAPH_ENDPOINT | Microsoft Graph API endpoint | https://graph.microsoft.com/v1.0 |
| NEXT_PUBLIC_BACKEND_URL | FastAPI backend URL | http://localhost:8000 |

## Features

### Authentication

The application uses Microsoft Authentication Library (MSAL) for user authentication. This provides secure access to Microsoft Graph API and ensures that users can only access their own data.

### Email Integration

- View recent emails
- Search emails by sender, subject, or content
- Sync emails to the backend database for RAG processing

### Calendar Integration

- View upcoming calendar events
- Manage calendar events
- Sync calendar events to the backend database for RAG processing

### Document Management

- Upload documents (PDF, Word, etc.)
- Process documents for RAG
- Manage uploaded documents

### AI Assistant

- Chat interface for natural language queries
- Context-aware responses based on emails, calendar events, and documents
- Suggested questions based on available data
- Markdown formatting support for rich responses

## Running the Frontend

From the project root directory:

```bash
npm run dev
```

This will start the Next.js development server on http://localhost:3000.

## Building for Production

```bash
npm run build
npm start
```

## Troubleshooting

- **Authentication Issues**: Verify your Azure App registration settings and ensure the redirect URI matches your environment.
- **Graph API Issues**: Check that your app has the necessary permissions in Azure AD.
- **Backend Connection Issues**: Ensure the backend server is running and accessible at the URL specified in NEXT_PUBLIC_BACKEND_URL.
- **UI Rendering Issues**: Check browser console for errors and verify that all dependencies are installed correctly. 