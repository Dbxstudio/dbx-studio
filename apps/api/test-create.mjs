const response = await fetch('http://localhost:3001/api/rpc/connections/create', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        name: 'Test Connection',
        type: 'postgresql',
        userId: '12345',
        host: 'dbx-auth.c4te8e4qywla.us-east-1.rds.amazonaws.com',
        port: 5432,
        database: 'dbx',
        username: 'sumrdb',
        password: 'ESwX2rOO3HWkU8x1Q5ReLw1i',
        ssl: true
    })
});

const data = await response.json();
console.log('Status:', response.status);
console.log('Response:', JSON.stringify(data, null, 2));
