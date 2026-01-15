/**
 * Test AWS Bedrock Authentication
 * Run with: bun run test-aws-bedrock.ts
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

// Test configuration
const TEST_CONFIG = {
    // Replace with your actual credentials
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'us-east-1',
    modelId: 'us.anthropic.claude-3-haiku-20240307-v1:0',
}

async function testBedrockConnection() {
    console.log('🧪 Testing AWS Bedrock Connection...\n')

    // Check if credentials are set
    if (!TEST_CONFIG.accessKeyId || !TEST_CONFIG.secretAccessKey) {
        console.error('❌ ERROR: AWS credentials not set!')
        console.log('\nPlease set environment variables:')
        console.log('  export AWS_ACCESS_KEY_ID="your-access-key"')
        console.log('  export AWS_SECRET_ACCESS_KEY="your-secret-key"')
        console.log('  export AWS_REGION="us-east-1"')
        console.log('\nOr edit this file and add them directly (for testing only)')
        process.exit(1)
    }

    console.log('📋 Configuration:')
    console.log(`  Region: ${TEST_CONFIG.region}`)
    console.log(`  Model: ${TEST_CONFIG.modelId}`)
    console.log(`  Access Key: ${TEST_CONFIG.accessKeyId.substring(0, 8)}...`)
    console.log(`  Secret Key: ${TEST_CONFIG.secretAccessKey.substring(0, 8)}...`)
    console.log()

    try {
        // Create Bedrock client
        console.log('🔧 Creating Bedrock client...')
        const client = new BedrockRuntimeClient({
            region: TEST_CONFIG.region,
            credentials: {
                accessKeyId: TEST_CONFIG.accessKeyId,
                secretAccessKey: TEST_CONFIG.secretAccessKey,
            },
        })
        console.log('✅ Client created successfully\n')

        // Prepare request
        console.log('📤 Preparing request...')
        const requestBody = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 100,
            messages: [
                { 
                    role: 'user', 
                    content: 'Say "Hello from AWS Bedrock!" and nothing else.' 
                },
            ],
        }

        console.log('Request body:')
        console.log(JSON.stringify(requestBody, null, 2))
        console.log()

        // Create command
        console.log('🚀 Invoking model...')
        const command = new InvokeModelCommand({
            modelId: TEST_CONFIG.modelId,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify(requestBody),
        })

        // Send request
        const startTime = Date.now()
        const response = await client.send(command)
        const duration = Date.now() - startTime

        console.log(`✅ Response received in ${duration}ms\n`)

        // Parse response
        const responseBody = JSON.parse(new TextDecoder().decode(response.body))
        
        console.log('📥 Response:')
        console.log(JSON.stringify(responseBody, null, 2))
        console.log()

        // Extract content
        const content = responseBody.content?.[0]?.text || ''
        console.log('💬 Extracted content:')
        console.log(`  "${content}"`)
        console.log()

        console.log('✅ SUCCESS: AWS Bedrock is working correctly!')
        console.log()

        // Additional info
        console.log('📊 Metadata:')
        console.log(`  Request ID: ${response.$metadata.requestId}`)
        console.log(`  HTTP Status: ${response.$metadata.httpStatusCode}`)
        console.log(`  Attempts: ${response.$metadata.attempts}`)
        console.log()

        return true

    } catch (error: any) {
        console.error('❌ ERROR: Bedrock request failed!\n')
        
        console.error('Error details:')
        console.error(`  Name: ${error.name}`)
        console.error(`  Message: ${error.message}`)
        
        if (error.$metadata) {
            console.error(`  HTTP Status: ${error.$metadata.httpStatusCode}`)
            console.error(`  Request ID: ${error.$metadata.requestId}`)
        }

        if (error.code) {
            console.error(`  Code: ${error.code}`)
        }

        console.error('\n📚 Common errors and solutions:')
        
        if (error.name === 'UnrecognizedClientException' || error.message?.includes('security token')) {
            console.error('  ⚠️  Invalid AWS credentials')
            console.error('      → Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
            console.error('      → Make sure there are no extra spaces or newlines')
            console.error('      → Verify the credentials are for the correct AWS account')
        }
        
        if (error.name === 'InvalidSignatureException' || error.message?.includes('signature')) {
            console.error('  ⚠️  Signature mismatch')
            console.error('      → Check your AWS_SECRET_ACCESS_KEY is correct')
            console.error('      → Ensure system time is synchronized (AWS requires accurate time)')
            console.error('      → Try regenerating your AWS credentials')
        }
        
        if (error.message?.includes('model') || error.message?.includes('not found')) {
            console.error('  ⚠️  Model not available')
            console.error('      → Check model ID is correct')
            console.error('      → Verify model is available in your region')
            console.error('      → Request access to the model in AWS Bedrock console')
        }

        if (error.message?.includes('AccessDeniedException')) {
            console.error('  ⚠️  Access denied')
            console.error('      → Check IAM permissions for bedrock:InvokeModel')
            console.error('      → Verify model access is granted in Bedrock console')
        }

        console.error('\n🔍 Full error object:')
        console.error(JSON.stringify(error, null, 2))
        console.error()

        return false
    }
}

// Test model ID encoding
function testModelIdEncoding() {
    console.log('🧪 Testing Model ID Encoding...\n')
    
    const modelId = TEST_CONFIG.modelId
    console.log(`Original model ID: ${modelId}`)
    console.log(`Encoded once:      ${encodeURIComponent(modelId)}`)
    console.log(`Encoded twice:     ${encodeURIComponent(encodeURIComponent(modelId))}`)
    console.log()
    
    console.log('✅ Model ID should be passed as-is to AWS SDK')
    console.log('   The SDK will handle URL encoding automatically')
    console.log()
}

// Main
async function main() {
    console.log('=' .repeat(80))
    console.log('AWS BEDROCK AUTHENTICATION TEST')
    console.log('='.repeat(80))
    console.log()

    testModelIdEncoding()
    
    const success = await testBedrockConnection()
    
    console.log('='.repeat(80))
    if (success) {
        console.log('✅ ALL TESTS PASSED')
    } else {
        console.log('❌ TESTS FAILED - See errors above')
    }
    console.log('='.repeat(80))
    console.log()

    process.exit(success ? 0 : 1)
}

main()
