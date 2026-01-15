import pg from 'pg';

const pool = new pg.Pool({
    host: 'dbx-auth.c4te8e4qywla.us-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'dbx',
    user: 'sumrdb',
    password: 'ESwX2rOO3HWkU8x1Q5ReLw1i',
    ssl: false,
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000
});

console.log('Testing connection...');

try {
    const client = await pool.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT 1 as test');
    console.log('✅ Query result:', result.rows);
    
    client.release();
    await pool.end();
    console.log('✅ Connection closed');
} catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', error);
    await pool.end();
    process.exit(1);
}
