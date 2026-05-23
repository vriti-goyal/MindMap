const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Checking columns in the Document table...");
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'Document';
  `);
  console.log("Document Columns:", res.rows);

  console.log("\nChecking all tables in the database...");
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public';
  `);
  console.log("Tables:", tablesRes.rows.map(t => t.table_name));
}

main()
  .catch(e => console.error("Error:", e))
  .finally(() => pool.end());
