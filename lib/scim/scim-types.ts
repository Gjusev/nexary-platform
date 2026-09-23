/**
 * SCIM 2.0 Type Definitions
 * Based on RFC 7643 and RFC 7644
 */

// Core SCIM 2.0 Types
export type SCIMResourceType = 'User' | 'Group';

/**
 * SCIM Error Response
 */
export interface SCIMErrorInput {
  status: string;
  scimType: string | null;
  detail: string;
}

export interface SCIMError extends SCIMErrorInput {
  schemas: string[];
}

/**
 * SCIM List Response with pagination
 */
export interface SCIMListResponse<T extends SCIMResource> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

/**
 * SCIM Patch Operation
 */
export interface SCIMPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path?: string;
  value?: any;
}

/**
 * Base SCIM Resource
 */
export interface SCIMResource {
  schemas: string[];
  id: string;
  externalId?: string;
  meta?: {
    resourceType: SCIMResourceType;
    location: string;
    created?: string;
    lastModified: string;
    version?: string;
  };
}

/**
 * SCIM Name object
 */
export interface SCIMName {
  givenName?: string;
  familyName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
  formatted?: string;
}

/**
 * SCIM Email object
 */
export interface SCIMEmail {
  value: string;
  type?: 'work' | 'home' | 'other';
  primary?: boolean;
}

/**
 * SCIM PhoneNumber object
 */
export interface SCIMPhoneNumber {
  value: string;
  type?: 'work' | 'home' | 'mobile' | 'fax' | 'pager' | 'other';
  primary?: boolean;
}

/**
 * SCIM User Resource
 * RFC 7643 Section 4.1
 */
export interface SCIMUser extends SCIMResource {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: SCIMName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;
  password?: string;
  emails?: SCIMEmail[];
  phoneNumbers?: SCIMPhoneNumber[];
  addresses?: SCIMAddress[];
  photos?: SCIMPhoto[];
  groups?: SCIMGroupRef[];
  enterprise?: SCIMEnterpriseExtension;
  meta?: {
    resourceType: 'User';
    location: string;
    created?: string;
    lastModified: string;
    version?: string;
  };
}

/**
 * SCIM Address object
 */
export interface SCIMAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: 'work' | 'home' | 'other';
}

/**
 * SCIM Photo object
 */
export interface SCIMPhoto {
  value: string;
  type?: 'photo' | 'thumbnail';
  primary?: boolean;
}

/**
 * SCIM Group Reference
 */
export interface SCIMGroupRef {
  value: string;
  ref?: string;
  display?: string;
  type: 'Group';
}

/**
 * SCIM Enterprise Extension
 */
export interface SCIMEnterpriseExtension {
  employeeNumber?: string;
  costCenter?: string;
  organization?: string;
  division?: string;
  department?: string;
  manager?: {
    value: string;
    ref?: string;
    displayName?: string;
  };
}

/**
 * SCIM Group Resource
 * RFC 7643 Section 4.2
 */
export interface SCIMGroup extends SCIMResource {
  schemas: string[];
  id: string;
  externalId?: string;
  displayName: string;
  members?: SCIMGroupMember[];
  meta?: {
    resourceType: 'Group';
    location: string;
    created?: string;
    lastModified: string;
    version?: string;
  };
}

/**
 * SCIM Group Member
 */
export interface SCIMGroupMember {
  value: string;
  ref?: string;
  type: 'User' | 'Group';
  display?: string;
}

/**
 * SCIM Schema Definition
 */
export interface SCIMSchema {
  schemas: string[];
  id: string;
  name: string;
  description: string;
  attributes: SCIMSchemaAttribute[];
  meta?: {
    resourceType: 'Schema';
    location: string;
  };
}

/**
 * SCIM Schema Attribute
 */
export interface SCIMSchemaAttribute {
  name: string;
  type: 'string' | 'boolean' | 'decimal' | 'integer' | 'dateTime' | 'reference' | 'complex';
  multiValued: boolean;
  description: string;
  required: boolean;
  caseExact: boolean;
  mutability?: 'readWrite' | 'readOnly' | 'immutable' | 'writeOnly';
  returned?: 'always' | 'never' | 'default' | 'request';
  uniqueness?: 'none' | 'server' | 'global';
  referenceTypes?: string[];
}

/**
 * SCIM Service Provider Config
 * RFC 7643 Section 5
 */
export interface SCIMServiceProviderConfig {
  schemas: string[];
  patch: {
    supported: boolean;
  };
  bulk: {
    supported: boolean;
    maxOperations: number;
    maxPayloadSize: number;
  };
  filter: {
    supported: boolean;
    maxResults: number;
  };
  changePassword: {
    supported: boolean;
  };
  sort: {
    supported: boolean;
  };
  etag: {
    supported: boolean;
  };
  authenticationSchemes: SCIMAuthenticationScheme[];
  meta?: {
    location: string;
    resourceType: 'ServiceProviderConfig';
  };
}

/**
 * SCIM Authentication Scheme
 */
export interface SCIMAuthenticationScheme {
  name: string;
  description: string;
  specUri?: string;
  documentationUri?: string;
  type: 'oauthbearertoken' | 'oauth2' | 'oauthbmws' | 'httpbasic';
  primary: boolean;
}

/**
 * SCIM Resource Type Endpoint
 * Describes a SCIM resource type endpoint (e.g., /Users, /Groups)
 */
export interface SCIMResourceTypeEndpoint {
  schemas: string[];
  id: string;
  name: string;
  endpoint: string;
  description: string;
  schema: string;
  schemaExtensions?: {
    schema: string;
    required: boolean;
  }[];
  meta?: {
    location: string;
    resourceType: 'ResourceType';
  };
}

/**
 * SCIM Search Request
 */
export interface SCIMSearchRequest {
  schemas: string[];
  filter?: string;
  startIndex?: number;
  count?: number;
  sortBy?: string;
  sortOrder?: 'ascending' | 'descending';
}

/**
 * Filter expression types
 */
export type SCIMFilterOperator =
  | 'eq'  // Equals
  | 'ne'  // Not Equals
  | 'co'  // Contains
  | 'sw'  // Starts With
  | 'ew'  // Ends With
  | 'pr'  // Present (has a value)
  | 'gt'  // Greater Than
  | 'ge'  // Greater Than or Equal
  | 'lt'  // Less Than
  | 'le'  // Less Than or Equal
  | 'and' // Logical AND
  | 'or'  // Logical OR
  | 'not'; // Logical NOT

/**
 * Parsed filter expression
 */
export interface SCIMFilterExpression {
  operator: SCIMFilterOperator;
  attributeName: string;
  value?: string;
  left?: SCIMFilterExpression;
  right?: SCIMFilterExpression;
}

/**
 * SCIM Sync Log Entry
 */
export interface SCIMSyncLog {
  id: string;
  teamSlug: string;
  operation: 'create' | 'update' | 'delete' | 'patch';
  resourceType: 'User' | 'Group';
  resourceId?: string;
  scimId?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  createdAt: Date;
}

/**
 * SCIM Token
 */
export interface SCIMToken {
  id: string;
  teamSlug: string;
  name: string;
  lastUsed?: Date;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
  // The actual token is only returned during creation
  token?: string;
}

/**
 * SCIM configuration for a team
 */
export interface SCIMConfig {
  enabled: boolean;
  tokens: SCIMToken[];
}

/**
 * Supported SCIM schemas
 */
export const SCIM_SCHEMAS = {
  USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  GROUP: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  ENTERPRISE_USER: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
  SERVICE_PROVIDER_CONFIG: 'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
  RESOURCE_TYPE: 'urn:ietf:params:scim:schemas:core:2.0:ResourceType',
  SCHEMA: 'urn:ietf:params:scim:schemas:core:2.0:Schema',
  BULK: 'urn:ietf:params:scim:api:messages:2.0:BulkRequest',
} as const;

/**
 * Helper to generate SCIM location URL
 */
export function getSCIMLocation(resourceType: SCIMResourceType, id: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/scim/v2/${resourceType}s/${id}`;
}

/**
 * Helper to generate SCIM meta object
 * Generic to preserve literal resource types
 */
export function createSCIMMeta<T extends SCIMResourceType>(
  resourceType: T,
  id: string,
  created?: Date,
  lastModified?: Date
): { resourceType: T; location: string; created?: string; lastModified: string } {
  const location = getSCIMLocation(resourceType, id);

  return {
    resourceType,
    location,
    created: created?.toISOString(),
    lastModified: (lastModified || new Date()).toISOString(),
  };
}
