# Next.js Outlook Integration Frontend

This directory contains the Next.js frontend for the Outlook Integration project. It provides a modern web interface for interacting with Microsoft Outlook data and the RAG-powered AI assistant.

## Architecture

The frontend follows a component-based architecture:

1. **Next.js Application**: Provides the React framework and routing.
2. **Microsoft Authentication**: Handles user authentication with Microsoft identity.
3. **Microsoft Graph API**: Retrieves Outlook data (emails, calendar events).
4. **Backend API Integration**: Communicates with the FastAPI backend for RAG queries.
5. **UI Components**: Reusable components for the user interface.
6. **Robust Error Handling**: Comprehensive error handling and data validation.
7. **Local Storage**: Persistent storage for chat history and sync status.

### Architecture Diagram

```mermaid
flowchart TB
    subgraph "Next.js Frontend"
        Next[Next.js Application]
        Auth[Microsoft Authentication]
        Graph[Microsoft Graph API Integration]
        Backend[Backend API Integration]
        UI[UI Components]
        Error[Error Handling]
        Storage[Local Storage]
        
        Next --> Auth
        Next --> Graph
        Next --> Backend
        Next --> UI
        Next --> Error
        Next --> Storage
        
        subgraph "UI Components"
            Assistant[Assistant.tsx]
            EmailList[EmailList.tsx]
            Calendar[Calendar.tsx]
            DocUpload[DocumentUpload.tsx]
            
            UI --> Assistant
            UI --> EmailList
            UI --> Calendar
            UI --> DocUpload
        end
    end
    
    subgraph "External Services"
        MS_Auth[Microsoft Identity]
        MS_Graph[Microsoft Graph API]
        FastAPI[FastAPI Backend]
    end
    
    Auth <--> MS_Auth
    Graph <--> MS_Graph
    Backend <--> FastAPI
```

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

### Component Diagram

```mermaid
classDiagram
    class Page {
        +layout()
        +render()
    }
    
    class Assistant {
        -messages: Message[]
        -isLoading: boolean
        +sendMessage(text: string)
        +clearConversation()
        +render()
    }
    
    class EmailList {
        -emails: Email[]
        -isLoading: boolean
        -page: number
        +fetchEmails()
        +syncEmails()
        +searchEmails(query: string)
        +render()
    }
    
    class Calendar {
        -events: Event[]
        -isLoading: boolean
        +fetchEvents()
        +syncEvents()
        +render()
    }
    
    class DocumentUpload {
        -documents: Document[]
        -isUploading: boolean
        +uploadDocument(file: File)
        +deleteDocument(id: string)
        +render()
    }
    
    class AuthProvider {
        -isAuthenticated: boolean
        -user: User
        +login()
        +logout()
        +getToken()
    }
    
    Page --> Assistant
    Page --> EmailList
    Page --> Calendar
    Page --> DocumentUpload
    Page --> AuthProvider
```

## Data Flow

1. **Authentication Flow**:
   - User logs in with Microsoft credentials
   - Application receives authentication token
   - Token is used for Microsoft Graph API calls and backend authentication

2. **Data Retrieval Flow**:
   - Application fetches emails and calendar events from Microsoft Graph API
   - Data is displayed in the UI and synchronized to the backend database
   - Robust error handling ensures data integrity even with incomplete or malformed data

3. **Query Flow**:
   - User enters a query in the Assistant component
   - Query is sent to the backend with the user's ID
   - Backend processes the query and returns a response
   - Response is displayed in the chat interface
   - Chat history is persisted in local storage

### Authentication Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant MSAL as Microsoft Authentication
    participant Graph as Microsoft Graph API
    participant Backend
    
    User->>Frontend: Click Login
    Frontend->>MSAL: Initiate login
    MSAL->>User: Redirect to Microsoft login
    User->>MSAL: Enter credentials
    MSAL->>Frontend: Return auth token
    Frontend->>Frontend: Store token
    
    Frontend->>Graph: Request user info
    Graph->>Frontend: Return user profile
    
    Frontend->>Backend: Send user ID
    Backend->>Frontend: Confirm user registration
    
    Frontend->>User: Display authenticated UI
```

### Data Retrieval Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Graph as Microsoft Graph API
    participant Backend
    
    User->>Frontend: Navigate to Emails/Calendar
    
    Frontend->>Graph: Request emails/events
    Graph->>Frontend: Return data
    
    Frontend->>Frontend: Process & validate data
    Frontend->>User: Display data
    
    User->>Frontend: Click Sync
    Frontend->>Backend: Send data for sync
    Backend->>Frontend: Confirm sync status
    
    alt Error occurs
        Graph->>Frontend: Return error/malformed data
        Frontend->>Frontend: Handle error
        Frontend->>User: Display error message
    end
```

### Query Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Assistant
    participant Backend
    participant LocalStorage
    
    User->>Assistant: Enter query
    Assistant->>Assistant: Update UI state
    
    Assistant->>Backend: Send query with user ID
    Backend->>Assistant: Process and return response
    
    Assistant->>Assistant: Format response
    Assistant->>User: Display response
    
    Assistant->>LocalStorage: Save conversation
    
    alt Clear conversation
        User->>Assistant: Click Clear
        Assistant->>Assistant: Reset conversation
        Assistant->>LocalStorage: Clear saved conversation
    end
```

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

- View recent emails with pagination
- Search emails by sender, subject, or content
- Sync emails to the backend database for RAG processing
- Robust error handling for various email formats
- Data validation to handle missing or malformed email data

### Calendar Integration

- View upcoming calendar events with pagination
- View next week's events
- Manage calendar events
- Sync calendar events to the backend database for RAG processing
- Robust error handling for various event formats
- Data validation to handle missing or malformed event data

### Document Management

- Upload documents (PDF, Word, etc.)
- Process documents for RAG
- Manage uploaded documents

### AI Assistant

- Chat interface for natural language queries
- Context-aware responses based on emails, calendar events, and documents
- Suggested questions based on available data
- Markdown formatting support for rich responses
- Persistent chat history using local storage
- Clear conversation option

### Database Synchronization

- One-click sync of all Outlook data to the backend database
- Progress indicators during synchronization
- Detailed error reporting for sync issues
- Automatic data validation and normalization
- Persistent sync status using local storage

### Features Diagram

```mermaid
mindmap
  root((Frontend Features))
    Authentication
      ::icon(fa fa-lock)
      Microsoft MSAL
      Secure token handling
      User-specific access
    Email Integration
      ::icon(fa fa-envelope)
      View emails
      Search functionality
      Sync to backend
      Error handling
    Calendar Integration
      ::icon(fa fa-calendar)
      View events
      Next week preview
      Sync to backend
      Error handling
    Document Management
      ::icon(fa fa-file)
      Upload documents
      Process for RAG
      Manage documents
    AI Assistant
      ::icon(fa fa-robot)
      Natural language queries
      Context-aware responses
      Persistent chat history
      Markdown support
    Database Sync
      ::icon(fa fa-database)
      One-click sync
      Progress indicators
      Error reporting
      Data validation
```

## Error Handling and Data Validation

The application implements comprehensive error handling and data validation:

- **API Error Handling**: All API calls are wrapped in try/catch blocks with specific error messages
- **Data Validation**: Incoming data from Microsoft Graph API is validated and normalized
- **Default Values**: Missing or malformed data is replaced with sensible defaults
- **User Feedback**: Clear error messages are displayed to the user when issues occur
- **Defensive Programming**: Optional chaining and nullish coalescing operators prevent runtime errors

### Error Handling Flow

```mermaid
flowchart TD
    API[API Call] --> Try{Try/Catch}
    Try -->|Success| Validate[Validate Data]
    Try -->|Error| HandleAPIError[Handle API Error]
    
    Validate --> DataCheck{Data Valid?}
    DataCheck -->|Yes| Process[Process Data]
    DataCheck -->|No| HandleDataError[Handle Data Error]
    
    HandleAPIError --> LogError[Log Error]
    HandleDataError --> LogError
    
    LogError --> UserFeedback[Display User Feedback]
    
    Process --> UI[Update UI]
```

## Deployment

### Vercel Deployment

The application is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Configure environment variables in the Vercel dashboard
3. Deploy the application

### Environment Configuration

For production deployment, ensure these environment variables are set:

- `NEXT_PUBLIC_CLIENT_ID`: Your Azure App client ID
- `NEXT_PUBLIC_AUTHORITY`: Microsoft identity authority URL
- `NEXT_PUBLIC_REDIRECT_URI`: Your production URL
- `NEXT_PUBLIC_GRAPH_ENDPOINT`: Microsoft Graph API endpoint
- `NEXT_PUBLIC_BACKEND_URL`: Your production backend URL

### Azure App Registration

For production deployment, update your Azure App registration:

1. Add your production URL to the list of redirect URIs
2. Ensure all required API permissions are granted
3. Configure authentication settings for production

### Deployment Flow

```mermaid
flowchart LR
    Dev[Development] --> Build[Build]
    Build --> Test[Test]
    Test --> Deploy[Deploy to Vercel]
    Deploy --> Config[Configure Environment]
    Config --> Azure[Update Azure App]
    Azure --> Live[Live Application]
```

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
- **Data Sync Issues**: If synchronization fails, check the browser console for detailed error messages and ensure the backend database is properly configured.
- **Missing Email Data**: Some email providers may return data in different formats; the application includes robust error handling to manage these variations.

### Troubleshooting Flow

```mermaid
flowchart TD
    Issue[Issue Detected] --> Category{Issue Category}
    
    Category -->|Authentication| AuthCheck[Check Azure Settings]
    Category -->|Graph API| PermCheck[Check Permissions]
    Category -->|Backend| BackendCheck[Check Backend Connection]
    Category -->|UI| ConsoleCheck[Check Browser Console]
    Category -->|Data Sync| SyncCheck[Check Sync Logs]
    
    AuthCheck --> AuthFix[Update Azure Settings]
    PermCheck --> PermFix[Grant Missing Permissions]
    BackendCheck --> BackendFix[Ensure Backend Running]
    ConsoleCheck --> UIFix[Fix UI Issues]
    SyncCheck --> SyncFix[Fix Data Format Issues]
    
    AuthFix --> Resolved[Issue Resolved]
    PermFix --> Resolved
    BackendFix --> Resolved
    UIFix --> Resolved
    SyncFix --> Resolved
``` 