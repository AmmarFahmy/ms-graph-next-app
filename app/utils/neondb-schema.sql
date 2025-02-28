-- Create tables for Outlook data

-- Create pgvector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Table for emails
CREATE TABLE IF NOT EXISTS outlook_mails (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    mail_id TEXT NOT NULL,
    subject TEXT,
    from_name TEXT,
    from_email TEXT,
    received_datetime TIMESTAMP WITH TIME ZONE,
    body_preview TEXT,
    is_read BOOLEAN,
    to_recipients JSONB,
    cc_recipients JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mail_id)
);

-- Table for calendar events
CREATE TABLE IF NOT EXISTS outlook_events (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    subject TEXT,
    body_preview TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    start_timezone TEXT,
    end_timezone TEXT,
    attendees JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Table for next week events
CREATE TABLE IF NOT EXISTS outlook_next_week_events (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    subject TEXT,
    body_preview TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE,
    end_datetime TIMESTAMP WITH TIME ZONE,
    start_timezone TEXT,
    end_timezone TEXT,
    attendees JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, event_id)
);

-- Tables for knowledge base
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    file_name TEXT,
    file_size INTEGER,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_pages (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    page_number INTEGER,
    page_content TEXT,
    page_embeddings vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_outlook_mails_user_id ON outlook_mails(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_events_user_id ON outlook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_next_week_events_user_id ON outlook_next_week_events(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_document_id ON document_pages(document_id);
CREATE INDEX IF NOT EXISTS idx_document_pages_user_id ON document_pages(user_id); 