import { PGlite } from '@electric-sql/pglite';

const pglite = new PGlite('./data/dbx.db');
const result = await pglite.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'connections'
    ORDER BY ordinal_position;
`);

console.log('Connections table columns:');
result.rows.forEach(row => {
    console.log(`  - ${row.column_name} (${row.data_type})`);
});

await pglite.close();
