/**
 * Standard Error Messages
 *
 * Centralized error message constants for consistent user-facing error messages
 * across the application. All messages should be in English for consistency,
 * with internationalization handled at the presentation layer.
 *
 * @module lib/errors/error-messages
 */

/**
 * Standard error message constants.
 * These are user-facing messages that should be consistent across the application.
 */
export const ErrorMessages = {
	// Authentication & Authorization Errors
	UNAUTHORIZED: 'Unauthorized - Please log in to continue',
	FORBIDDEN: 'Forbidden - You do not have permission to perform this action',
	INVALID_CREDENTIALS: 'Invalid email or password',
	SESSION_EXPIRED: 'Your session has expired. Please log in again',
	EMAIL_NOT_VERIFIED: 'Please verify your email address before continuing',
	EMAIL_ALREADY_VERIFIED: 'Email is already verified',

	// User & Account Errors
	USER_NOT_FOUND: 'User not found',
	USER_ALREADY_EXISTS: 'A user with this email already exists',
	INVALID_EMAIL: 'Please provide a valid email address',
	INVALID_PASSWORD: 'Password does not meet requirements',
	WEAK_PASSWORD: 'Password must be at least 8 characters long',

	// Team Errors
	TEAM_NOT_FOUND: 'Team not found',
	TEAM_ALREADY_EXISTS: 'A team with this name already exists',
	INSUFFICIENT_PERMISSIONS: 'You do not have sufficient permissions',
	NOT_TEAM_MEMBER: 'You are not a member of this team',
	ALREADY_TEAM_MEMBER: 'User is already a member of this team',
	TEAM_OWNER_CANNOT_LEAVE: 'Team owner cannot leave the team. Transfer ownership first.',
	INVALID_TEAM_SLUG: 'Invalid team identifier',

	// RAG & Document Errors
	RAG_NOT_FOUND: 'RAG package not found',
	RAG_ALREADY_EXISTS: 'A RAG package with this name already exists',
	DOCUMENT_NOT_FOUND: 'Document not found',
	INVALID_FILE_TYPE: 'Invalid file type. Please upload a supported file format.',
	FILE_TOO_LARGE: 'File is too large. Please upload a smaller file.',
	DOCUMENT_PROCESSING_FAILED: 'Failed to process document. Please try again.',
	QUOTA_EXCEEDED: 'You have exceeded your quota. Please upgrade your plan.',

	// Chat & Conversation Errors
	CONVERSATION_NOT_FOUND: 'Conversation not found',
	INVALID_CONVERSATION_ID: 'Invalid conversation identifier',
	MESSAGE_TOO_LONG: 'Message is too long. Please shorten it.',
	INVALID_MESSAGE_CONTENT: 'Message contains invalid content',

	// Validation Errors
	INVALID_INPUT: 'Invalid input. Please check your data and try again.',
	MISSING_REQUIRED_FIELD: 'Required field is missing',
	INVALID_FORMAT: 'Invalid data format',
	VALUE_TOO_SHORT: 'Value is too short',
	VALUE_TOO_LONG: 'Value is too long',
	INVALID_CHOICE: 'Invalid selection. Please choose from available options.',

	// Rate Limiting Errors
	RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
	RATE_LIMITED_ADMIN: 'Too many admin requests. Please slow down.',
	SUSPICIOUS_ACTIVITY: 'Suspicious activity detected. Please try again later.',

	// Network & Server Errors
	NETWORK_ERROR: 'Network error. Please check your connection and try again.',
	SERVER_ERROR: 'Something went wrong. Please try again later.',
	SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
	TIMEOUT: 'Request timed out. Please try again.',
	UPLOAD_FAILED: 'Failed to upload file. Please try again.',

	// Database Errors
	DATABASE_ERROR: 'Database error. Please try again later.',
	DUPLICATE_ENTRY: 'This entry already exists.',
	FOREIGN_KEY_CONSTRAINT: 'Referenced resource does not exist.',

	// External Service Errors
	EXTERNAL_SERVICE_ERROR: 'External service error. Please try again later.',
	INVALID_API_KEY: 'Invalid API key. Please check your configuration.',
	API_QUOTA_EXCEEDED: 'API quota exceeded. Please try again later.',
	AI_SERVICE_ERROR: 'AI service error. Please try again.',

	// File Upload Errors
	FILE_NOT_FOUND: 'File not found',
	INVALID_FILE_NAME: 'Invalid file name',
	MALICIOUS_FILE_DETECTED: 'Malicious file detected. Upload blocked.',
	VIRUS_DETECTED: 'Virus detected. File rejected.',

	// Generic Errors (fallbacks)
	UNKNOWN_ERROR: 'An unknown error occurred',
	OPERATION_FAILED: 'Operation failed. Please try again.',
	NOT_IMPLEMENTED: 'This feature is not yet implemented.',
	MAINTENANCE_MODE: 'The application is currently under maintenance. Please try again later.',

	// Aliases for backward compatibility
	NOT_FOUND: 'Resource not found',
	INTERNAL_ERROR: 'Something went wrong. Please try again later.',
	MISSING_FIELD: 'Required field is missing',
} as const;

/**
 * Type for error message keys.
 */
export type ErrorMessageKey = keyof typeof ErrorMessages;

/**
 * Human-readable error message types for categorization.
 */
export type ErrorCategory =
	| 'authentication'
	| 'authorization'
	| 'validation'
	| 'not_found'
	| 'conflict'
	| 'rate_limit'
	| 'external_service'
	| 'database'
	| 'network'
	| 'server'
	| 'file'
	| 'unknown';

/**
 * Maps error message keys to error categories.
 */
export const ErrorCategories: Record<ErrorMessageKey, ErrorCategory> = {
	UNAUTHORIZED: 'authentication',
	FORBIDDEN: 'authorization',
	INVALID_CREDENTIALS: 'authentication',
	SESSION_EXPIRED: 'authentication',
	EMAIL_NOT_VERIFIED: 'authentication',
	EMAIL_ALREADY_VERIFIED: 'authentication',

	USER_NOT_FOUND: 'not_found',
	USER_ALREADY_EXISTS: 'conflict',
	INVALID_EMAIL: 'validation',
	INVALID_PASSWORD: 'validation',
	WEAK_PASSWORD: 'validation',

	TEAM_NOT_FOUND: 'not_found',
	TEAM_ALREADY_EXISTS: 'conflict',
	INSUFFICIENT_PERMISSIONS: 'authorization',
	NOT_TEAM_MEMBER: 'authorization',
	ALREADY_TEAM_MEMBER: 'conflict',
	TEAM_OWNER_CANNOT_LEAVE: 'authorization',
	INVALID_TEAM_SLUG: 'validation',

	RAG_NOT_FOUND: 'not_found',
	RAG_ALREADY_EXISTS: 'conflict',
	DOCUMENT_NOT_FOUND: 'not_found',
	INVALID_FILE_TYPE: 'validation',
	FILE_TOO_LARGE: 'validation',
	DOCUMENT_PROCESSING_FAILED: 'server',
	QUOTA_EXCEEDED: 'authorization',

	CONVERSATION_NOT_FOUND: 'not_found',
	INVALID_CONVERSATION_ID: 'validation',
	MESSAGE_TOO_LONG: 'validation',
	INVALID_MESSAGE_CONTENT: 'validation',

	INVALID_INPUT: 'validation',
	MISSING_REQUIRED_FIELD: 'validation',
	INVALID_FORMAT: 'validation',
	VALUE_TOO_SHORT: 'validation',
	VALUE_TOO_LONG: 'validation',
	INVALID_CHOICE: 'validation',

	RATE_LIMITED: 'rate_limit',
	RATE_LIMITED_ADMIN: 'rate_limit',
	SUSPICIOUS_ACTIVITY: 'authorization',

	NETWORK_ERROR: 'network',
	SERVER_ERROR: 'server',
	SERVICE_UNAVAILABLE: 'server',
	TIMEOUT: 'network',
	UPLOAD_FAILED: 'server',

	DATABASE_ERROR: 'database',
	DUPLICATE_ENTRY: 'conflict',
	FOREIGN_KEY_CONSTRAINT: 'validation',

	EXTERNAL_SERVICE_ERROR: 'external_service',
	INVALID_API_KEY: 'validation',
	API_QUOTA_EXCEEDED: 'rate_limit',
	AI_SERVICE_ERROR: 'external_service',

	FILE_NOT_FOUND: 'not_found',
	INVALID_FILE_NAME: 'validation',
	MALICIOUS_FILE_DETECTED: 'authorization',
	VIRUS_DETECTED: 'authorization',

	UNKNOWN_ERROR: 'unknown',
	OPERATION_FAILED: 'server',
	NOT_IMPLEMENTED: 'server',
	MAINTENANCE_MODE: 'server',

	// Aliases for backward compatibility
	NOT_FOUND: 'not_found',
	INTERNAL_ERROR: 'server',
	MISSING_FIELD: 'validation',
};

/**
 * HTTP status codes for each error type.
 */
export const ErrorStatusCodes: Record<ErrorMessageKey, number> = {
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	INVALID_CREDENTIALS: 401,
	SESSION_EXPIRED: 401,
	EMAIL_NOT_VERIFIED: 403,
	EMAIL_ALREADY_VERIFIED: 400,

	USER_NOT_FOUND: 404,
	USER_ALREADY_EXISTS: 409,
	INVALID_EMAIL: 400,
	INVALID_PASSWORD: 400,
	WEAK_PASSWORD: 400,

	TEAM_NOT_FOUND: 404,
	TEAM_ALREADY_EXISTS: 409,
	INSUFFICIENT_PERMISSIONS: 403,
	NOT_TEAM_MEMBER: 403,
	ALREADY_TEAM_MEMBER: 409,
	TEAM_OWNER_CANNOT_LEAVE: 403,
	INVALID_TEAM_SLUG: 400,

	RAG_NOT_FOUND: 404,
	RAG_ALREADY_EXISTS: 409,
	DOCUMENT_NOT_FOUND: 404,
	INVALID_FILE_TYPE: 400,
	FILE_TOO_LARGE: 413,
	DOCUMENT_PROCESSING_FAILED: 500,
	QUOTA_EXCEEDED: 429,

	CONVERSATION_NOT_FOUND: 404,
	INVALID_CONVERSATION_ID: 400,
	MESSAGE_TOO_LONG: 400,
	INVALID_MESSAGE_CONTENT: 400,

	INVALID_INPUT: 400,
	MISSING_REQUIRED_FIELD: 400,
	INVALID_FORMAT: 400,
	VALUE_TOO_SHORT: 400,
	VALUE_TOO_LONG: 400,
	INVALID_CHOICE: 400,

	RATE_LIMITED: 429,
	RATE_LIMITED_ADMIN: 429,
	SUSPICIOUS_ACTIVITY: 429,

	NETWORK_ERROR: 503,
	SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
	TIMEOUT: 504,
	UPLOAD_FAILED: 500,

	DATABASE_ERROR: 500,
	DUPLICATE_ENTRY: 409,
	FOREIGN_KEY_CONSTRAINT: 400,

	EXTERNAL_SERVICE_ERROR: 502,
	INVALID_API_KEY: 401,
	API_QUOTA_EXCEEDED: 429,
	AI_SERVICE_ERROR: 502,

	FILE_NOT_FOUND: 404,
	INVALID_FILE_NAME: 400,
	MALICIOUS_FILE_DETECTED: 403,
	VIRUS_DETECTED: 403,

	UNKNOWN_ERROR: 500,
	OPERATION_FAILED: 500,
	NOT_IMPLEMENTED: 501,
	MAINTENANCE_MODE: 503,

	// Aliases for backward compatibility
	NOT_FOUND: 404,
	INTERNAL_ERROR: 500,
	MISSING_FIELD: 400,
};

/**
 * Gets a standardized error message by key.
 *
 * @param key - The error message key
 * @returns The standardized error message
 *
 * @example
 * ```typescript
 * const message = getErrorMessage('USER_NOT_FOUND'); // "User not found"
 * ```
 */
export function getErrorMessage(key: ErrorMessageKey): string {
	return ErrorMessages[key];
}

/**
 * Gets the error category for a given error message key.
 *
 * @param key - The error message key
 * @returns The error category
 *
 * @example
 * ```typescript
 * const category = getErrorCategory('UNAUTHORIZED'); // "authentication"
 * ```
 */
export function getErrorCategory(key: ErrorMessageKey): ErrorCategory {
	return ErrorCategories[key];
}

/**
 * Gets the recommended HTTP status code for a given error message key.
 *
 * @param key - The error message key
 * @returns The HTTP status code
 *
 * @example
 * ```typescript
 * const statusCode = getStatusCode('FORBIDDEN'); // 403
 * ```
 */
export function getStatusCode(key: ErrorMessageKey): number {
	return ErrorStatusCodes[key];
}

/**
 * Checks if an error is client-side (4xx) vs server-side (5xx).
 *
 * @param key - The error message key
 * @returns true if the error is client-side (4xx)
 *
 * @example
 * ```typescript
 * const isClientError = isClientError('INVALID_INPUT'); // true
 * const isServerError = isClientError('SERVER_ERROR'); // false
 * ```
 */
export function isClientError(key: ErrorMessageKey): boolean {
	const code = getStatusCode(key);
	return code >= 400 && code < 500;
}

/**
 * Checks if an error is server-side (5xx).
 *
 * @param key - The error message key
 * @returns true if the error is server-side (5xx)
 *
 * @example
 * ```typescript
 * const isServerError = isServerError('DATABASE_ERROR'); // true
 * ```
 */
export function isServerError(key: ErrorMessageKey): boolean {
	const code = getStatusCode(key);
	return code >= 500 && code < 600;
}

/**
 * Checks if an error is retryable (transient) vs permanent.
 *
 * @param key - The error message key
 * @returns true if the error is potentially retryable
 *
 * @example
 * ```typescript
 * const retryable = isRetryable('TIMEOUT'); // true
 * const notRetryable = isRetryable('USER_NOT_FOUND'); // false
 * ```
 */
export function isRetryable(key: ErrorMessageKey): boolean {
	const retryableErrors: ErrorMessageKey[] = [
		'NETWORK_ERROR',
		'TIMEOUT',
		'SERVICE_UNAVAILABLE',
		'EXTERNAL_SERVICE_ERROR',
		'RATE_LIMITED',
		'RATE_LIMITED_ADMIN',
		'SERVER_ERROR',
		'DATABASE_ERROR',
		'AI_SERVICE_ERROR',
	];
	return retryableErrors.includes(key);
}
