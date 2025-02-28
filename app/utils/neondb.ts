import { Pool } from 'pg';

// Create a connection pool to NeonDB - this will only run on the server
let pool: Pool | null = null;

// Initialize the pool only on the server side
if (typeof window === 'undefined') {
    pool = new Pool({
        connectionString: process.env.NEONDB_CONNECTION_STRING || 'postgresql://llm-twin-data_owner:npg_RA6ObELJ5omV@ep-icy-lake-a543yc0v-pooler.us-east-2.aws.neon.tech/llm-twin-data?sslmode=require'
    });

    // Test the connection
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Error connecting to NeonDB:', err);
        } else {
            console.log('Connected to NeonDB successfully!');
        }
    });
}

// Helper functions for database operations - these will only execute on the server

// Upsert function for emails
export const upsertEmails = async (emails: any[]) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const email of emails) {
            await client.query(
                `INSERT INTO outlook_mails 
         (user_id, mail_id, subject, from_name, from_email, received_datetime, body_preview, is_read, to_recipients, cc_recipients)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, mail_id) 
         DO UPDATE SET 
           subject = EXCLUDED.subject,
           from_name = EXCLUDED.from_name,
           from_email = EXCLUDED.from_email,
           received_datetime = EXCLUDED.received_datetime,
           body_preview = EXCLUDED.body_preview,
           is_read = EXCLUDED.is_read,
           to_recipients = EXCLUDED.to_recipients,
           cc_recipients = EXCLUDED.cc_recipients`,
                [
                    email.user_id,
                    email.mail_id,
                    email.subject,
                    email.from_name,
                    email.from_email,
                    email.received_datetime,
                    email.body_preview,
                    email.is_read,
                    JSON.stringify(email.to_recipients),
                    JSON.stringify(email.cc_recipients)
                ]
            );
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error upserting emails:', error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

// Upsert function for events
export const upsertEvents = async (events: any[], tableName: string) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        for (const event of events) {
            await client.query(
                `INSERT INTO ${tableName} 
         (user_id, event_id, subject, body_preview, start_datetime, end_datetime, start_timezone, end_timezone, attendees)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, event_id) 
         DO UPDATE SET 
           subject = EXCLUDED.subject,
           body_preview = EXCLUDED.body_preview,
           start_datetime = EXCLUDED.start_datetime,
           end_datetime = EXCLUDED.end_datetime,
           start_timezone = EXCLUDED.start_timezone,
           end_timezone = EXCLUDED.end_timezone,
           attendees = EXCLUDED.attendees`,
                [
                    event.user_id,
                    event.event_id,
                    event.subject,
                    event.body_preview,
                    event.start_datetime,
                    event.end_datetime,
                    event.start_timezone,
                    event.end_timezone,
                    JSON.stringify(event.attendees)
                ]
            );
        }

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error upserting events to ${tableName}:`, error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

// Function to insert document and get its ID
export const insertDocument = async (document: any) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    const client = await pool.connect();
    try {
        const result = await client.query(
            `INSERT INTO documents 
       (user_id, title, file_name, file_size, file_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
            [
                document.user_id,
                document.title,
                document.file_name,
                document.file_size,
                document.file_type
            ]
        );

        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('Error inserting document:', error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

// Function to insert document page
export const insertDocumentPage = async (page: any) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    const client = await pool.connect();
    try {
        // Ensure embeddings are in the correct format for PostgreSQL vector type
        // Convert the embedding array to a properly formatted PostgreSQL vector string
        let formattedEmbeddings = page.page_embeddings;

        // If embeddings is an array, format it properly for PostgreSQL vector
        if (Array.isArray(formattedEmbeddings)) {
            formattedEmbeddings = `[${formattedEmbeddings.join(',')}]`;
        }

        await client.query(
            `INSERT INTO document_pages 
       (document_id, user_id, page_number, page_content, page_embeddings)
       VALUES ($1, $2, $3, $4, $5)`,
            [
                page.document_id,
                page.user_id,
                page.page_number,
                page.page_content,
                formattedEmbeddings
            ]
        );

        return { success: true };
    } catch (error) {
        console.error('Error inserting document page:', error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

// Function to get documents by user ID
export const getDocumentsByUserId = async (userId: string) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    try {
        const result = await pool.query(
            `SELECT * FROM documents 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
            [userId]
        );

        return { success: true, data: result.rows };
    } catch (error) {
        console.error('Error getting documents:', error);
        return { success: false, error };
    }
};

// Function to delete document and its pages
export const deleteDocument = async (docId: number) => {
    if (!pool) {
        return { success: false, error: new Error('Database connection not available on client side') };
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Delete document pages first (should cascade, but being explicit)
        await client.query(
            `DELETE FROM document_pages 
       WHERE document_id = $1`,
            [docId]
        );

        // Delete the document
        await client.query(
            `DELETE FROM documents 
       WHERE id = $1`,
            [docId]
        );

        await client.query('COMMIT');
        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting document:', error);
        return { success: false, error };
    } finally {
        client.release();
    }
};

export { pool as neondb }; 