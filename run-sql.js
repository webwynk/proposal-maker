const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.qvpzfbmjokdesipdqdvn:133223%40WeBWynK@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to Supabase Postgres');
    
    const sql = fs.readFileSync('C:\\Users\\hasan\\.gemini\\antigravity\\brain\\26cc0e99-1b61-4fad-b7e5-dfd1ce590d15\\supabase_init.sql', 'utf8');
    await client.query(sql);
    console.log('SQL script executed successfully!');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

run();
