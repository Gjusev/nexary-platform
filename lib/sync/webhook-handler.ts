/**
 * Webhook Handler
 * Handles incoming webhooks from external sources
 *
 * Features:
 * - Signature verification
 * - Event parsing
 * - Automatic sync triggering
 * - Source-specific handlers
 */

import { pool } from '../db';
import { ConnectorFactory, type ConnectorAuthConfig } from '../connectors/connector-factory';
import type { BaseConnector, WebhookEvent } from '../connectors/base-connector';
import { decryptCredentials } from '../crypto-utils';
import { getSyncProcessor } from './sync-processor';
import * as crypto from 'crypto';

export interface WebhookPayload {
  sourceType: string;
  dataSourceId: string;
  eventType: string;
  timestamp: Date;
  payload: Record<string, unknown>;
  signature?: string;
}

export interface WebhookResult {
  success: boolean;
  syncJobId?: string;
  documentProcessed?: boolean;
  error?: string;
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(
  sourceType: string,
  payload: string,
  signature: string,
  dataSourceId: string
): Promise<boolean> {
  try {
    // Get webhook secret from data source config
    const result = await pool.query(`
      SELECT config
      FROM projectnexus.data_sources
      WHERE id = $1
    `, [dataSourceId]);

    if (result.rows.length === 0) {
      return false;
    }

    const config = result.rows[0].config as Record<string, unknown>;
    const webhookSecret = config.webhookSecret as string | undefined;

    if (!webhookSecret) {
      // No signature verification configured
      return true;
    }

    // Source-specific signature verification
    switch (sourceType) {
      case 'confluence':
        // Confluence uses JWT verification (complex, skip for now)
        return true;

      case 'notion':
        // Notion doesn't have webhooks yet
        return false;

      case 'sharepoint':
        // SharePoint uses HMAC-SHA256
        return verifyHmacSignature(payload, signature, webhookSecret);

      case 'google_drive':
        // Google uses different verification
        return true;

      case 'slack':
        // Slack uses signing secret
        return verifySlackSignature(payload, signature, webhookSecret);

      default:
        return true;
    }
  } catch (error) {
    console.error('[Webhook Handler] Error verifying signature:', error);
    return false;
  }
}

/**
 * Verify HMAC signature
 */
function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const computed = hmac.digest('hex');

  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computed, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Verify Slack signature
 */
function verifySlackSignature(
  payload: string,
  signature: string,
  signingSecret: string
): boolean {
  // Slack signature format: "v0=<hash>"
  const [version, hash] = signature.split('=');

  if (version !== 'v0') {
    return false;
  }

  const baseString = `v0:${payload.split('\n')[0]}:${payload}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(baseString);
  const computed = `${version}=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computed)
  );
}

/**
 * Handle incoming webhook
 */
export async function handleWebhook(
  sourceType: string,
  dataSourceId: string,
  rawPayload: string,
  signature?: string
): Promise<WebhookResult> {
  try {
    // Verify signature if provided
    if (signature) {
      const valid = await verifyWebhookSignature(
        sourceType,
        rawPayload,
        signature,
        dataSourceId
      );

      if (!valid) {
        return {
          success: false,
          error: 'Invalid signature'
        };
      }
    }

    // Parse payload
    const payload = JSON.parse(rawPayload);

    // Parse webhook event based on source type
    const event = await parseWebhookEvent(sourceType, payload);

    if (!event) {
      return {
        success: false,
        error: 'Failed to parse webhook event'
      };
    }

    // Load data source
    const dataSource = await loadDataSourceForWebhook(dataSourceId);
    if (!dataSource) {
      return {
        success: false,
        error: 'Data source not found'
      };
    }

    // Create connector
    const connector = await createConnectorForWebhook(dataSource);
    if (!connector) {
      return {
        success: false,
        error: 'Failed to create connector'
      };
    }

    // Handle webhook with connector
    const document = await connector.handleWebhook(event);

    if (document) {
      // Process the document
      await processWebhookDocument(dataSource, document);
    }

    // Trigger sync job for the data source
    const syncJobId = await triggerWebhookSync(dataSourceId);

    return {
      success: true,
      syncJobId,
      documentProcessed: !!document
    };
  } catch (error) {
    console.error('[Webhook Handler] Error handling webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Parse webhook event based on source type
 */
async function parseWebhookEvent(
  sourceType: string,
  payload: Record<string, unknown>
): Promise<WebhookEvent | null> {
  switch (sourceType) {
    case 'confluence':
      return parseConfluenceWebhook(payload);

    case 'sharepoint':
      return parseSharePointWebhook(payload);

    case 'google_drive':
      return parseGoogleDriveWebhook(payload);

    case 'slack':
      return parseSlackWebhook(payload);

    default:
      return null;
  }
}

/**
 * Parse Confluence webhook event
 */
function parseConfluenceWebhook(payload: Record<string, unknown>): WebhookEvent | null {
  // Confluence webhooks have structure like:
  // { webhookId, timestamp, eventType, content { id, type, status } }
  const eventType = payload.eventType as string;
  const content = payload.content as Record<string, unknown> | undefined;
  const documentId = content?.id as string;
  const timestamp = new Date(payload.timestamp as string || Date.now());

  if (!eventType || !documentId) {
    return null;
  }

  // Map event types
  let changeType: 'created' | 'updated' | 'deleted' = 'updated';
  if (eventType.includes('created')) {
    changeType = 'created';
  } else if (eventType.includes('removed') || eventType.includes('deleted')) {
    changeType = 'deleted';
  } else if (eventType.includes('updated')) {
    changeType = 'updated';
  }

  return {
    eventType: changeType,
    documentId,
    timestamp,
    payload
  };
}

/**
 * Parse SharePoint webhook event
 */
function parseSharePointWebhook(payload: Record<string, unknown>): WebhookEvent | null {
  // SharePoint webhooks have structure like:
  // { subscriptionId, clientState, expirationDateTime, resources, validationToken }
  const resources = payload.resources as string[] | undefined;
  const validationToken = payload.validationToken as string | undefined;

  // Validation request
  if (validationToken) {
    return null; // Handle validation separately
  }

  if (!resources || resources.length === 0) {
    return null;
  }

  // Return first resource
  return {
    eventType: 'updated',
    documentId: resources[0],
    timestamp: new Date(),
    payload
  };
}

/**
 * Parse Google Drive webhook event
 */
function parseGoogleDriveWebhook(payload: Record<string, unknown>): WebhookEvent | null {
  // Google Drive webhooks use notification format:
  // { kind, resourceId, stateChanged, resourceUri }
  const resourceId = payload.resourceId as string;
  const stateChanged = payload.stateChanged as boolean;

  if (!resourceId) {
    return null;
  }

  return {
    eventType: stateChanged ? 'updated' : 'created',
    documentId: resourceId,
    timestamp: new Date(),
    payload
  };
}

/**
 * Parse Slack webhook event
 */
function parseSlackWebhook(payload: Record<string, unknown>): WebhookEvent | null {
  // Slack webhooks have structure like:
  // { type, team_id, api_app_id, event { type, user, text, ts, channel } }
  const type = payload.type as string;
  const event = payload.event as Record<string, unknown> | undefined;

  if (type === 'url_verification') {
    return null; // Handle verification separately
  }

  if (!event) {
    return null;
  }

  const eventType = event.type as string;
  const eventId = event.ts as string; // Slack uses timestamp as ID

  return {
    eventType: eventType.includes('message') ? 'created' : 'updated',
    documentId: eventId,
    timestamp: new Date(),
    payload
  };
}

/**
 * Load data source for webhook processing
 */
async function loadDataSourceForWebhook(
  dataSourceId: string
): Promise<{
  id: string;
  teamSlug: string;
  sourceType: string;
  config: Record<string, unknown>;
  autoRagPackageIds: string[];
} | null> {
  const result = await pool.query(`
    SELECT
      id,
      team_slug as "teamSlug",
      source_type as "sourceType",
      config,
      auto_rag_package_ids as "autoRagPackageIds"
    FROM projectnexus.data_sources
    WHERE id = $1
      AND status = 'active'
      AND archived_at IS NULL
  `, [dataSourceId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Decrypt credentials
  let config = row.config as Record<string, unknown>;
  if (config.credentials && typeof config.credentials === 'string') {
    try {
      config.credentials = await decryptCredentials(config.credentials);
    } catch (error) {
      console.error('[Webhook Handler] Error decrypting credentials:', error);
      return null;
    }
  }

  return {
    id: row.id,
    teamSlug: row.teamSlug,
    sourceType: row.sourceType,
    config,
    autoRagPackageIds: row.autoRagPackageIds || []
  };
}

/**
 * Create connector for webhook processing
 */
async function createConnectorForWebhook(
  dataSource: { id: string; sourceType: string; config: Record<string, unknown> }
): Promise<BaseConnector | null> {
  try {
    const config: ConnectorAuthConfig = {
      type: dataSource.config.type as any,
      credentials: dataSource.config.credentials as Record<string, string>,
      baseUrl: dataSource.config.baseUrl as string | undefined
    };

    return ConnectorFactory.create(dataSource.sourceType, config, dataSource.id);
  } catch (error) {
    console.error('[Webhook Handler] Error creating connector:', error);
    return null;
  }
}

/**
 * Process document from webhook
 */
async function processWebhookDocument(
  dataSource: { id: string; teamSlug: string; sourceType: string; autoRagPackageIds: string[] },
  document: { externalId: string; externalUrl?: string; title: string; content: string }
): Promise<void> {
  // This would process the document similar to sync processor
  // For now, just log that processing should happen
  // TODO: Integrate with sync processor or document processor
}

/**
 * Trigger webhook sync job
 */
async function triggerWebhookSync(dataSourceId: string): Promise<string> {
  const result = await pool.query(`
    INSERT INTO projectnexus.sync_jobs (
      data_source_id,
      job_type,
      trigger_type,
      status,
      metadata
    ) VALUES ($1, 'incremental', 'webhook', 'pending', $2)
    RETURNING id
  `, [dataSourceId, JSON.stringify({ triggerType: 'webhook', triggeredAt: new Date() })]);

  return result.rows[0].id;
}

/**
 * Handle URL verification (for SharePoint, Slack, etc.)
 */
export function handleUrlVerification(
  sourceType: string,
  payload: Record<string, unknown>
): string | null {
  switch (sourceType) {
    case 'sharepoint':
      // Return validation token
      return payload.validationToken as string || null;

    case 'slack':
      // Return challenge
      return payload.challenge as string || null;

    default:
      return null;
  }
}

/**
 * Register webhook routes helper
 * This would be used in the API routes file
 */
export function getWebhookRouteConfig(
  sourceType: string
): {
  path: string;
  method: string;
  handler: (dataSourceId: string, body: string, signature?: string) => Promise<WebhookResult>;
} {
  return {
    path: `/api/webhooks/${sourceType}/:dataSourceId`,
    method: 'POST',
    handler: async (dataSourceId: string, body: string, signature?: string) => {
      return handleWebhook(sourceType, dataSourceId, body, signature);
    }
  };
}
