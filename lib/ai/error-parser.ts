/**
 * AI Provider Error Parser
 *
 * Parses errors from AI provider APIs and converts them to appropriate error classes.
 * Supports OpenAI, Anthropic, Google Gemini, and Mistral error formats.
 */

import {
	InsufficientCreditsError,
	ModelNotAvailableError,
	ModelDeprecatedError,
	AIProviderError,
	ContentFilterError,
	ContextLengthExceededError,
	RateLimitError,
	ApiError,
} from '@/lib/errors/api-error';

export interface AIProviderErrorResponse {
	error?: {
		message?: string;
		type?: string;
		code?: string | number;
		status?: number;
	};
	type?: string;
	message?: string;
	code?: string | number;
}

/**
 * Parses an error response from an AI provider and throws the appropriate error.
 *
 * @param provider - The AI provider name (e.g., 'openai', 'anthropic')
 * @param response - The error response from the API
 * @param model - The model that was being used (optional)
 * @throws ApiError or one of its subclasses
 */
export function parseAIProviderError(
	provider: string,
	response: AIProviderErrorResponse | string,
	model?: string
): never {
	let errorMessage: string;
	let errorType: string;
	let errorCode: string | number | undefined;

	if (typeof response === 'string') {
		errorMessage = response;
		errorType = 'unknown';
	} else {
		errorMessage = response.error?.message || response.message || 'Unknown error';
		errorType = response.error?.type || response.type || 'unknown';
		errorCode = response.error?.code || response.code;
	}

	const lowerMessage = errorMessage.toLowerCase();

	// Check for insufficient credits / billing errors
	if (
		lowerMessage.includes('insufficient') &&
		(lowerMessage.includes('credit') ||
			lowerMessage.includes('quota') ||
			lowerMessage.includes('balance') ||
			lowerMessage.includes('billing'))
	) {
		throw new InsufficientCreditsError(provider, errorMessage);
	}

	// Check for context length exceeded
	if (
		lowerMessage.includes('context') ||
		lowerMessage.includes('token') && lowerMessage.includes('exceed') ||
		lowerMessage.includes('maximum') && lowerMessage.includes('length') ||
		errorCode === 'context_length_exceeded'
	) {
		// Try to extract token limits from error message
		const maxMatch = errorMessage.match(/max(?:imum)?\s*(?:\d+|[\d,]+)/i);
		const currentMatch = errorMessage.match(/current\s*(?:\d+|[\d,]+)/i);
		const maxLength = maxMatch ? parseInt(maxMatch[1].replace(/,/g, '')) : 0;
		const actualLength = currentMatch ? parseInt(currentMatch[1].replace(/,/g, '')) : 0;

		throw new ContextLengthExceededError(
			provider,
			model || 'unknown',
			maxLength,
			actualLength,
			errorMessage
		);
	}

	// Check for model not available or invalid model
	if (
		lowerMessage.includes('model') &&
		(lowerMessage.includes('not found') ||
			lowerMessage.includes('does not exist') ||
			lowerMessage.includes('invalid') ||
			lowerMessage.includes('not available') ||
			lowerMessage.includes('access')) ||
		errorCode === 'model_not_found'
	) {
		throw new ModelNotAvailableError(provider, model || 'unknown', errorMessage);
	}

	// Check for model deprecated
	if (
		lowerMessage.includes('deprecated') ||
		lowerMessage.includes('no longer supported') ||
		errorCode === 'model_deprecated'
	) {
		// Try to extract suggested alternatives
		const alternatives: string[] = [];
		const altMatch = errorMessage.match(/(?:try|use|switch to)\s+:?\s*([a-z0-9-]+(?:,\s*[a-z0-9-]+)*)/i);
		if (altMatch) {
			alternatives.push(...altMatch[1].split(',').map(s => s.trim()));
		}

		throw new ModelDeprecatedError(
			provider,
			model || 'unknown',
			alternatives.length > 0 ? alternatives : ['gpt-4o', 'gpt-4o-mini'],
			errorMessage
		);
	}

	// Check for content filter / safety violations
	if (
		lowerMessage.includes('content') &&
		(lowerMessage.includes('policy') ||
			lowerMessage.includes('safety') ||
			lowerMessage.includes('flagged') ||
			lowerMessage.includes('violation')) ||
		errorCode === 'content_filter'
	) {
		throw new ContentFilterError(provider, errorMessage, errorMessage);
	}

	// Check for rate limit errors
	if (
		lowerMessage.includes('rate') && lowerMessage.includes('limit') ||
		lowerMessage.includes('too many requests') ||
		lowerMessage.includes('quota') && lowerMessage.includes('exceeded') ||
		errorCode === 'rate_limit_exceeded'
	) {
		throw new RateLimitError(errorMessage);
	}

	// Check for invalid API key
	if (
		lowerMessage.includes('api key') &&
		(lowerMessage.includes('invalid') ||
			lowerMessage.includes('not found') ||
			lowerMessage.includes('missing') ||
			lowerMessage.includes('unauthorized')) ||
		errorCode === 'invalid_api_key'
	) {
		throw new AIProviderError(provider, errorMessage);
	}

	// Generic AI provider error
	throw new ApiError(errorMessage, 500, `AI_${provider.toUpperCase()}_ERROR`, {
		provider,
		model,
		originalError: errorType,
	});
}

/**
 * Wraps an AI provider API call and handles errors appropriately.
 *
 * @param provider - The AI provider name
 * @param apiCall - The API call function
 * @param model - The model being used (optional)
 * @returns The API response
 * @throws ApiError or one of its subclasses
 */
export async function withAIErrorHandling<T>(
	provider: string,
	apiCall: () => Promise<T>,
	model?: string
): Promise<T> {
	try {
		return await apiCall();
	} catch (error) {
		// If it's already an ApiError, rethrow it
		if (error instanceof ApiError) {
			throw error;
		}

		// Parse the error and throw appropriate error type
		if (error instanceof Error) {
			try {
				const parsed = JSON.parse(error.message);
				parseAIProviderError(provider, parsed, model);
			} catch {
				// If parsing fails, treat as generic error
				parseAIProviderError(provider, error.message, model);
			}
		}

		// Unknown error type
		throw new ApiError(
			`Unknown error from ${provider}`,
			500,
			`AI_${provider.toUpperCase()}_UNKNOWN_ERROR`,
			{ provider, model, originalError: String(error) }
		);
	}
}
