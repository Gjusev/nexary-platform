// RAG Document Types

export type RagDocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export type RagDocument = {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  chunkCount: number;
  pointIds?: string[];
  // Enhanced fields
  tags: string[];
  status: RagDocumentStatus;
  version: number;
  parentDocumentId?: string;
  queryCount: number;
  lastQueriedAt?: string;
  archivedAt?: string;
  errorMessage?: string;
};

export type RagPackage = {
  id: string;
  teamSlug: string;
  name: string;
  description?: string;
  collectionName: string;
  createdAt: string;
  updatedAt: string;
  documents: RagDocument[];
};

export type CreatePackageInput = {
  teamSlug: string;
  name: string;
  description?: string;
};

export type RagPackageSummary = RagPackage & {
  documentCount: number;
  totalChunks: number;
};

// =====================================================
// Master Document Types (Centralized Document Hub)
// =====================================================

export type MasterDocument = {
  id: string;
  teamSlug: string;
  userId: string;
  filename: string;
  originalFilename: string;
  size: number;
  contentType: string;
  // Storage
  bucket?: string;
  objectKey?: string;
  sha256?: string;
  // Metadata
  extractedText?: string;
  tags: string[];
  status: RagDocumentStatus;
  errorMessage?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  deletedAt?: string;
  // Populated on fetch
  ragAssignments?: DocumentRagAssignment[];
};

export type DocumentRagAssignment = {
  id: string;
  masterDocumentId: string;
  ragPackageId: string;
  ragPackageName?: string; // Joined from rag_packages
  ragPackageDescription?: string;
  // Processing state
  status: 'pending' | 'processing' | 'ready' | 'failed';
  chunkCount: number;
  pointIds: string[];
  errorMessage?: string;
  // Analytics
  queryCount: number;
  lastQueriedAt?: string;
  // Timestamps
  assignedAt: string;
  processedAt?: string;
  assignedBy?: string;
};

// API Response Types
export type MasterDocumentListResponse = {
  success: boolean;
  documents?: MasterDocument[];
  total?: number;
  error?: string;
};

export type MasterDocumentResponse = {
  success: boolean;
  document?: MasterDocument;
  error?: string;
};

export type AssignmentResponse = {
  success: boolean;
  assignments?: DocumentRagAssignment[];
  error?: string;
};

// Filter types for document hub
export type DocumentFilters = {
  search?: string;
  status?: RagDocumentStatus | 'all';
  tags?: string[];
  ragPackageId?: string;
  showArchived?: boolean;
};
