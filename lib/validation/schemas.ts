/**
 * Validation Schemas using Zod
 *
 * Centralized validation for API endpoints
 * Ensures type safety and data integrity
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Email validation schema
 */
export const emailSchema = z.string().email();

/**
 * Slug validation schema (for team slugs, etc.)
 */
export const slugSchema = z.string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens allowed');

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, 'End date must be after start date');

// ============================================================================
// User Schemas
// ============================================================================

export const userSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  displayName: z.string().min(1).max(100).optional(),
  profileImageUrl: z.string().url().optional(),
});

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  ),
  displayName: z.string().min(1).max(100).optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  profileImageUrl: z.string().url().optional(),
});

// ============================================================================
// Team Schemas
// ============================================================================

export const teamSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
});

// ============================================================================
// Team Member Schemas
// ============================================================================

export const teamMemberSchema = z.object({
  userId: uuidSchema,
  teamSlug: slugSchema,
  role: z.enum(['team-owner', 'team-leader', 'member']),
  status: z.enum(['active', 'inactive', 'removed']),
});

export const addTeamMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(['team-leader', 'member']).default('member'),
});

export const updateTeamMemberRoleSchema = z.object({
  role: z.enum(['team-owner', 'team-leader', 'member']),
});

// ============================================================================
// Chat Schemas
// ============================================================================

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).default(0.7),
  maxTokens: z.coerce.number().int().positive().max(4096).optional(),
  stream: z.boolean().default(true),
  ragPackageId: uuidSchema.optional(),
});

export const chatConversationSchema = z.object({
  id: uuidSchema,
  teamSlug: slugSchema,
  title: z.string().min(1).max(200),
  model: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ============================================================================
// RAG Schemas
// ============================================================================

export const ragPackageSchema = z.object({
  id: uuidSchema,
  teamSlug: slugSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const createRAGPackageSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const ragDocumentSchema = z.object({
  id: uuidSchema,
  packageId: uuidSchema,
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  chunkCount: z.number().int().nonnegative(),
});

export const ragSearchSchema = z.object({
  query: z.string().min(1).max(1000),
  packageId: uuidSchema,
  limit: z.coerce.number().int().positive().max(50).default(10),
  method: z.enum(['hybrid', 'semantic', 'lexical']).default('hybrid'),
  alpha: z.coerce.number().min(0).max(1).default(0.5),
});

// ============================================================================
// Authentication Schemas
// ============================================================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string(),
  callbackUrl: z.string().url().optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  displayName: z.string().min(1).max(100).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

// ============================================================================
// File Upload Schemas
// ============================================================================

export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
  ]),
  size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
});

export const documentUploadSchema = z.object({
  packageId: uuidSchema,
  file: z.any().refine(file => file && file.size <= 10 * 1024 * 1024, 'File size must be less than 10MB'),
});

// ============================================================================
// API Key Schemas
// ============================================================================

export const apiKeySchema = z.object({
  id: uuidSchema,
  teamSlug: slugSchema,
  name: z.string().min(1).max(100),
  keyPrefix: z.string().length(8),
  scopes: z.array(z.string()),
  lastUsed: z.date().optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum([
    'chat:read',
    'chat:write',
    'rag:read',
    'rag:write',
    'documents:read',
    'documents:write',
  ])).default([]),
  expiresAt: z.coerce.date().optional(),
});

// ============================================================================
// Advanced RAG Schemas
// ============================================================================

export const advancedRAGSearchSchema = z.object({
  packageId: uuidSchema,
  query: z.string().min(1).max(1000),
  method: z.enum(['hybrid', 'semantic', 'lexical']).default('hybrid'),
  rerank: z.enum(['cohere', 'cross-encoder', 'ensemble', 'mmr', 'none']).optional(),
  expandQuery: z.boolean().default(true),
  queryVariations: z.coerce.number().int().min(1).max(10).default(3),
  limit: z.coerce.number().int().positive().max(50).default(10),
  alpha: z.coerce.number().min(0).max(1).default(0.5),
  diversity: z.coerce.number().min(0).max(1).default(0.5),
});

// ============================================================================
// Audit Log Schemas
// ============================================================================

export const auditLogQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  teamSlug: slugSchema.optional(),
  userId: uuidSchema.optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).default(100),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.startDate <= data.endDate;
  }
  return true;
}, 'End date must be after start date');

// ============================================================================
// Export Schemas
// ============================================================================

export const exportSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  format: z.enum(['csv', 'json', 'syslog']).default('json'),
  teamSlug: slugSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type User = z.infer<typeof userSchema>;
export type Team = z.infer<typeof teamSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type RAGSearch = z.infer<typeof ragSearchSchema>;
export type AdvancedRAGSearch = z.infer<typeof advancedRAGSearchSchema>;
export type APIKey = z.infer<typeof apiKeySchema>;
