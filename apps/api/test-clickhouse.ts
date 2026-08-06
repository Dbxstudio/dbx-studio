// Test if Bun.fetch (not node compat layer) works with rejectUnauthorized
const HOST = 'x5skneb9a9.asia-southeast1.gcp.clickhouse.cloud'
const PORT = 8443
const USERNAME = 'default'
const PASSWORD = 'ZcUD76.vHGk.s'

console.log('Test: Bun.fetch with tls config')
try {
    const url = `https://${HOST}:${PORT}/?query=${encodeURIComponent('SELECT 1 AS ok')}&default_format=JSONCompact`
    // @ts-ignore
    const res = await Bun.fetch(url, {
        headers: {
            'X-ClickHouse-User': USERNAME,
            'X-ClickHouse-Key': PASSWORD,
        },
        tls: {
            rejectUnauthorized: false,
        }
    })
    const text = await res.text()
    console.log('✅ Bun.fetch works:', text.trim())
} catch (e: any) {
    console.error('❌ Bun.fetch failed:', e.message)
}

// Try using http instead of https - ClickHouse Cloud may support http on different port
console.log('\nTest: HTTP (unencrypted) on port 8123 through ClickHouse Cloud')
try {
    const r = await fetch(`http://${HOST}:8123/?query=SELECT+1&default_format=JSONCompact`, {
        headers: {
            'X-ClickHouse-User': USERNAME,
            'X-ClickHouse-Key': PASSWORD,
        }
    })
    const t = await r.text()
    console.log('✅ HTTP 8123 works:', t.trim())
} catch (e: any) {
    console.error('❌ HTTP 8123 failed:', e.message)
}

// Try using clickhouse native protocol port 9000 (TCP, not HTTP)
console.log('\nEnv check:')
console.log('NODE_TLS_REJECT_UNAUTHORIZED:', process.env.NODE_TLS_REJECT_UNAUTHORIZED)
