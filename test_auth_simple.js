
// Native fetch is available in Node 18+ and Bun
const makeRequest = async (label, body) => {
    console.log(`\n--- Testing ${label} ---`);
    console.log('Sending payload:', JSON.stringify(body));

    try {
        const response = await fetch('http://localhost:3002/api/rpc/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log(`Status: ${response.status}`);
        const text = await response.text();
        try {
            console.log('Response Body:', JSON.stringify(JSON.parse(text), null, 2));
        } catch (e) {
            console.log('Response Body (raw):', text);
        }
    } catch (err) {
        console.error('Network Error:', err.message);
    }
};

(async () => {
    // 1. Raw Payload (what frontend currently sends)
    await makeRequest('Raw Payload', {
        email: 'test@example.com',
        password: 'password123'
    });

    // 2. Wrapped in "input" (common RPC style)
    await makeRequest('Wrapped in "input"', {
        input: {
            email: 'test@example.com',
            password: 'password123'
        }
    });

    // 3. Wrapped in "json" (Trpc/Hono RPC sometimes)
    await makeRequest('Wrapped in "json"', {
        json: {
            email: 'test@example.com',
            password: 'password123'
        }
    });
})();
