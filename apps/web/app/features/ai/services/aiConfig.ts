/**
 * AI Providers and Models Configuration
 * Centralized AI providers, service IDs, and models metadata
 * 
 * Supported Providers:
 * - DBX Agent (Server-side) - Our default model
 * - AWS Bedrock - Amazon Bedrock AI models (Claude, Llama)
 * - OpenAI - GPT models
 * - Claude - Direct Anthropic API
 */

export interface Provider {
    id: string
    name: string
    description: string
    serviceId: number
    requiresCredentials: boolean
}

export interface Model {
    modelId: number
    providerId: string
    label: string
    modelName: string
    isThinking?: boolean
}

// Only supported providers
export const PROVIDERS: Provider[] = [
    {
        id: 'dbx-agent',
        name: 'DBX Agent',
        description: 'DBX Agent Query Analyzer (Server-side, Recommended)',
        serviceId: 8,
        requiresCredentials: false, // Uses server credentials
    },
    {
        id: 'bedrock',
        name: 'AWS Bedrock',
        description: 'Amazon Bedrock AI models (Claude, Llama)',
        serviceId: 1,
        requiresCredentials: true, // Requires AWS keys
    },
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI API models (GPT-4, GPT-5)',
        serviceId: 2,
        requiresCredentials: true, // Requires OpenAI API key
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Direct Anthropic Claude API',
        serviceId: 3,
        requiresCredentials: true, // Requires Anthropic API key
    },
]

// Models for supported providers
export const MODELS: Model[] = [
    // DBX Agent models (Query Analyzer) - Server-side, no credentials needed
    { modelId: 801, providerId: 'dbx-agent', label: 'Max', modelName: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0' },
    { modelId: 802, providerId: 'dbx-agent', label: 'Max (Thinking)', modelName: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0', isThinking: true },
    { modelId: 803, providerId: 'dbx-agent', label: 'Pro', modelName: 'gpt-oss-120b' },
    { modelId: 804, providerId: 'dbx-agent', label: 'Pro (Thinking)', modelName: 'gpt-oss-120b', isThinking: true },
    { modelId: 805, providerId: 'dbx-agent', label: 'Lite', modelName: 'qwen.qwen3-235b-a22b-2507-v1:0' },

    // AWS Bedrock models
    { modelId: 1, providerId: 'bedrock', label: 'Claude 3 Haiku', modelName: 'us.anthropic.claude-3-haiku-20240307-v1:0' },
    { modelId: 2, providerId: 'bedrock', label: 'Claude 3 Sonnet', modelName: 'us.anthropic.claude-3-sonnet-20240229-v1:0' },
    { modelId: 3, providerId: 'bedrock', label: 'Claude 3.5 Haiku', modelName: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' },
    { modelId: 4, providerId: 'bedrock', label: 'Claude 3.5 Sonnet', modelName: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0' },
    { modelId: 5, providerId: 'bedrock', label: 'Claude 3.7 Sonnet', modelName: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0' },
    { modelId: 6, providerId: 'bedrock', label: 'Claude Sonnet 4', modelName: 'global.anthropic.claude-sonnet-4-20250514-v1:0' },
    { modelId: 7, providerId: 'bedrock', label: 'Llama 3.3 70B', modelName: 'us.meta.llama3-3-70b-instruct-v1:0' },
    { modelId: 9, providerId: 'bedrock', label: 'Llama 4 Maverick 17B', modelName: 'us.meta.llama4-maverick-17b-instruct-v1:0' },
    { modelId: 10, providerId: 'bedrock', label: 'Llama 4 Scout 17B', modelName: 'us.meta.llama4-scout-17b-instruct-v1:0' },

    // OpenAI models
    { modelId: 210, providerId: 'openai', label: 'GPT-5.2', modelName: 'gpt-5.2' },
    { modelId: 211, providerId: 'openai', label: 'GPT-5.1', modelName: 'gpt-5.1' },
    { modelId: 212, providerId: 'openai', label: 'GPT-5', modelName: 'gpt-5' },
    { modelId: 213, providerId: 'openai', label: 'GPT-5 Mini', modelName: 'gpt-5-mini' },
    { modelId: 220, providerId: 'openai', label: 'GPT-4.1', modelName: 'gpt-4.1' },
    { modelId: 221, providerId: 'openai', label: 'GPT-4.1 Mini', modelName: 'gpt-4.1-mini' },
    { modelId: 201, providerId: 'openai', label: 'GPT-4o', modelName: 'gpt-4o' },
    { modelId: 202, providerId: 'openai', label: 'GPT-4o Mini', modelName: 'gpt-4o-mini' },

    // Anthropic Claude models (direct API)
    { modelId: 310, providerId: 'claude', label: 'Claude Sonnet 4.5', modelName: 'claude-sonnet-4-5-20250929' },
    { modelId: 313, providerId: 'claude', label: 'Claude Sonnet 4', modelName: 'claude-sonnet-4-20250514' },
    { modelId: 311, providerId: 'claude', label: 'Claude Haiku 4.5', modelName: 'claude-haiku-4-5-20251001' },
    { modelId: 315, providerId: 'claude', label: 'Claude Haiku 3.5', modelName: 'claude-3-5-haiku-20241022' },
]

export function getProviderById(providerId: string): Provider | undefined {
    return PROVIDERS.find(p => p.id === providerId)
}

export function getModelsByProvider(providerId: string): Model[] {
    return MODELS.filter(m => m.providerId === providerId)
}

export function getModelById(modelId: number): Model | undefined {
    return MODELS.find(m => m.modelId === modelId)
}

export function getDefaultProvider(): Provider {
    return PROVIDERS[0] // dbx-agent
}

export function getDefaultModel(providerId: string): Model | undefined {
    const models = getModelsByProvider(providerId)
    return models[0]
}

/**
 * Check if credentials are required for a provider
 */
export function providerRequiresCredentials(providerId: string): boolean {
    const provider = getProviderById(providerId)
    return provider?.requiresCredentials ?? true
}

/**
 * Get credential fields needed for a provider
 */
export function getCredentialFieldsForProvider(providerId: string): string[] {
    switch (providerId) {
        case 'dbx-agent':
            return [] // No credentials needed - uses server
        case 'bedrock':
            return ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION']
        case 'openai':
            return ['OPENAI_API_KEY']
        case 'claude':
            return ['ANTHROPIC_API_KEY']
        default:
            return []
    }
}
