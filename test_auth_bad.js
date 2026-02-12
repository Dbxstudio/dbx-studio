
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
            const json = JSON.parse(text);
            console.log('Error Message:', json.message || json.json?.message);
            if (json.json?.issues) {
                console.log('Issues:', JSON.stringify(json.json.issues));
            }
        } catch (e) {
            console.log('Response Body (raw):', text);
        }
    } catch (err) {
        console.error('Network Error:', err.message);
    }
};

(async () => {
    // 1. Invalid Email
    await makeRequest('Invalid Email', {
        email: 'invalid-email',
        password: 'password123'
    });

    // 2. Short Password
    await makeRequest('Short Password', {
        email: 'test@example.com',
        password: '123'
    });

    // 3. Valid (but authorized/unauthorized)
    await makeRequest('Valid Request', {
        email: 'test@example.com',
        password: 'password123'
    });
})();
