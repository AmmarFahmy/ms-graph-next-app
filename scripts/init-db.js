const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function initializeDatabase() {
  // Create a connection pool to NeonDB
  const pool = new Pool({
    connectionString: process.env.NEONDB_CONNECTION_STRING
  });

  try {
    console.log('Connecting to NeonDB...');
    
    // Test the connection
    const testResult = await pool.query('SELECT NOW()');
    console.log('Connected to NeonDB successfully!', testResult.rows[0]);
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../app/utils/neondb-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Initializing database schema...');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await pool.end();
  }
}

initializeDatabase().catch(console.error); 