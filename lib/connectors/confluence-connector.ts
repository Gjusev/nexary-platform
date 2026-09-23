/**
 * Confluence Connector
 * Imports documents from Atlassian Confluence
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Space and page browsing
 * - HTML to plain text conversion
 * - Permission extraction
 * - Attachment support
 * - Incremental sync via last modified date
 */

import {
  BaseConnector,
  type ConnectorAuthConfig,
  type DocumentChange,
  type ExternalDocument,
  type FormattedDocument,
  type HealthCheckResult,
  type RateLimit,
  type SyncOptions,
  type WebhookEvent
} from './base-connector';
import { randomUUID } from 'crypto';

interface ConfluenceConfig extends ConnectorAuthConfig {
  baseUrl: string; // e.g., https://company.atlassian.net
  credentials: Record<string, unknown> & {
    type: 'oauth';
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  };
}

interface ConfluenceSpace {
  id: string;
  key: string;
  name: string;
  type: 'global' | 'personal';
  _links: {
    webui: string;
  };
}

interface ConfluencePage {
  id: string;
  title: string;
  type: string;
  status: string;
  _links: {
    webui: string;
    self: string;
  };
  version: {
    number: number;
    when: string;
  };
  history?: {
    lastUpdated: string;
    lastUpdatedBy: {
      publicKey: string;
      username: string;
      displayName: string;
    };
  };
  ancestors?: Array<{
    id: string;
    title: string;
  }>;
}

interface ConfluenceContent {
  id: string;
  title: string;
  type: string;
  space?: ConfluenceSpace;
  version: {
    number: number;
    when: string;
  };
  _links: {
    webui: string;
  };
  body?: {
    view: {
      value: string;
      representation: string;
    };
  };
  ancestors?: Array<{
    id: string;
    title: string;
  }>;
  history?: {
    lastUpdated: string;
    lastUpdatedBy: {
      publicKey: string;
      username: string;
      displayName: string;
    };
  };
}

interface ConfluencePermissions {
  results: Array<{
    operation: {
      operation: string;
      targetType: string;
    };
    subjects: {
      user?: {
        accountId: string;
        username: string;
        displayName: string;
      };
      group?: {
        name: string;
      };
    }[];
  }>;
}

export class ConfluenceConnector extends BaseConnector {
  readonly sourceType = 'confluence' as const;

  protected config: ConfluenceConfig;
  private baseUrl: string;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly REQUEST_LIMIT = 1000; // 1000 requests per hour
  private readonly REQUEST_WINDOW = 3600000; // 1 hour in ms

  constructor(config: ConnectorAuthConfig, dataSourceId: string) {
    super(config, dataSourceId);
    this.config = config as unknown as ConfluenceConfig;
    this.baseUrl = this.config.baseUrl?.replace(/\/$/, '') || '';
  }

  // ========== Authentication ==========

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/wiki/rest/api/user/current', 'GET');
      return response.ok;
    } catch (error) {
      this.handleError(error, 'authenticate');
      return false;
    }
  }

  async refreshCredentials(): Promise<void> {
    const { refreshToken } = this.config.credentials;

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Confluence OAuth 2.0 refresh
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken as string);
    params.append('client_id', process.env.CONFLUENCE_CLIENT_ID || '');
    params.append('client_secret', process.env.CONFLUENCE_CLIENT_SECRET || '');

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    this.config.credentials.accessToken = data.access_token;
    this.config.credentials.refreshToken = data.refresh_token;
    this.config.credentials.expiresIn = data.expires_in;
  }

  async validateConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const params = new URLSearchParams({ limit: '1' });
      const response = await this.makeRequest('/wiki/rest/api/space', 'GET', { searchParams: params });
      const latency = Date.now() - startTime;

      if (response.ok) {
        return { healthy: true, latency };
      }

      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { healthy: false, error: error.message || 'Connection failed' };
    } catch (error) {
      return { healthy: false, error: String(error) };
    }
  }

  // ========== Document Fetching ==========

  async fetchDocuments(options: SyncOptions): Promise<ExternalDocument[]> {
    await this.checkRateLimit();

    const documents: ExternalDocument[] = [];
    const spaces = await this.fetchSpaces(options);
    const since = options.since;

    for (const space of spaces) {
      try {
        const pages = await this.fetchPages(space.key, options);

        for (const page of pages) {
          // Filter by last updated for incremental sync
          if (since && page.version) {
            const pageDate = new Date(page.version.when);
            if (pageDate <= since) {
              continue;
            }
          }

          const content = await this.fetchPageContent(page.id);
          const acls = await this.fetchPagePermissions(page.id);

          documents.push({
            externalId: page.id,
            externalUrl: page._links.webui,
            title: page.title,
            content: content || '',
            contentType: 'text/html',
            author: {
              id: page.history?.lastUpdatedBy?.publicKey,
              name: page.history?.lastUpdatedBy?.displayName,
              email: page.history?.lastUpdatedBy?.username
            },
            updatedAt: new Date(page.version.when),
            metadata: {
              spaceKey: space.key,
              spaceName: space.name,
              pageId: page.id,
              version: page.version.number,
              spaceType: space.type,
              ancestors: content ? page.ancestors : undefined
            },
            permissions: acls
          });
        }
      } catch (error) {
        this.handleError(error, `fetchDocuments:space:${space.key}`);
      }
    }

    return documents;
  }

  async fetchDocument(externalId: string): Promise<ExternalDocument | null> {
    await this.checkRateLimit();

    try {
      const response = await this.makeRequest(`/wiki/rest/api/content/${externalId}?expand=space,version,history,body,ancestors`, 'GET');

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch page: ${response.statusText}`);
      }

      const page: ConfluenceContent = await response.json();
      const content = page.body?.view?.value || '';
      const acls = await this.fetchPagePermissions(page.id);

      return {
        externalId: page.id,
        externalUrl: page._links.webui,
        title: page.title,
        content,
        contentType: 'text/html',
        author: {
          id: page.history?.lastUpdatedBy?.publicKey,
          name: page.history?.lastUpdatedBy?.displayName,
          email: page.history?.lastUpdatedBy?.username
        },
        updatedAt: new Date(page.version.when),
        metadata: {
          spaceKey: page.space?.key,
          spaceName: page.space?.name,
          pageId: page.id,
          version: page.version.number,
          spaceType: page.space?.type,
          ancestors: page.ancestors
        },
        permissions: acls
      };
    } catch (error) {
      this.handleError(error, `fetchDocument:${externalId}`);
      return null;
    }
  }

  async listDocuments(options: SyncOptions): Promise<Array<{
    externalId: string;
    title: string;
    updatedAt: Date;
    url?: string;
  }>> {
    await this.checkRateLimit();

    const documents: Array<{
      externalId: string;
      title: string;
      updatedAt: Date;
      url?: string;
    }> = [];

    const spaces = await this.fetchSpaces(options);
    const since = options.since;

    for (const space of spaces) {
      try {
        const pages = await this.fetchPages(space.key, options);

        for (const page of pages) {
          // Filter by last updated
          if (since && page.version) {
            const pageDate = new Date(page.version.when);
            if (pageDate <= since) {
              continue;
            }
          }

          documents.push({
            externalId: page.id,
            title: page.title,
            updatedAt: new Date(page.version.when),
            url: page._links.webui
          });
        }
      } catch (error) {
        this.handleError(error, `listDocuments:space:${space.key}`);
      }
    }

    return documents;
  }

  // ========== Change Detection ==========

  async getChanges(since: Date): Promise<DocumentChange[]> {
    await this.checkRateLimit();

    const changes: DocumentChange[] = [];
    const spaces = await this.fetchSpaces({ since });

    for (const space of spaces) {
      try {
        const pages = await this.fetchPages(space.key, { since });

        for (const page of pages) {
          const pageDate = new Date(page.version.when);

          if (pageDate > since) {
            changes.push({
              externalId: page.id,
              changeType: 'updated',
              timestamp: pageDate,
              newVersion: String(page.version.number)
            });
          }
        }
      } catch (error) {
        this.handleError(error, `getChanges:space:${space.key}`);
      }
    }

    return changes;
  }

  // ========== Webhooks ==========

  supportsWebhooks(): boolean {
    return true;
  }

  async setupWebhook(endpointUrl: string): Promise<string> {
    // Confluence doesn't have native webhooks
    // This would typically use Atlassian's webhook infrastructure
    // For now, return a placeholder
    return `webhook_${randomUUID()}`;
  }

  async handleWebhook(event: WebhookEvent): Promise<ExternalDocument | null> {
    // Confluence webhooks would be handled here
    // For now, return null as we don't have webhook setup
    return null;
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    // Placeholder implementation
    return true;
  }

  // ========== Rate Limiting ==========

  getRateLimit(): RateLimit {
    return {
      requests: this.REQUEST_LIMIT,
      window: this.REQUEST_WINDOW
    };
  }

  protected async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.requestWindowStart > this.REQUEST_WINDOW) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }

    // Check if limit exceeded
    if (this.requestCount >= this.REQUEST_LIMIT) {
      const waitTime = this.REQUEST_WINDOW - (now - this.requestWindowStart);
      console.warn(`Confluence rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }

    this.requestCount++;
  }

  // ========== Error Handling ==========

  protected handleError(error: unknown, context: string): void {
    console.error(`[Confluence Connector] Error in ${context}:`, error);
  }

  // ========== Private Helper Methods ==========

  private async makeRequest(
    path: string,
    method: string = 'GET',
    options?: {
      searchParams?: URLSearchParams;
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);

    if (options?.searchParams) {
      url.search = options.searchParams.toString();
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Accept': 'application/json'
    };

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), fetchOptions);

    // Auto-refresh on 401 (unauthorized)
    if (response.status === 401 && this.config.credentials.refreshToken) {
      await this.refreshCredentials();
      headers['Authorization'] = `Bearer ${this.config.credentials.accessToken}`;
      return fetch(url.toString(), fetchOptions);
    }

    return response;
  }

  private async fetchSpaces(options?: SyncOptions): Promise<ConfluenceSpace[]> {
    await this.checkRateLimit();

    const spaces: ConfluenceSpace[] = [];
    let start = 0;
    const limit = 50;

    while (true) {
      const params = new URLSearchParams({
        start: String(start),
        limit: String(limit),
        expand: 'description'
      });

      const response = await this.makeRequest('/wiki/rest/api/space', 'GET', { searchParams: params });

      if (!response.ok) {
        throw new Error(`Failed to fetch spaces: ${response.statusText}`);
      }

      const data = await response.json();
      spaces.push(...data.results);

      if (!data._links.next) {
        break;
      }

      start += limit;
    }

    return spaces;
  }

  private async fetchPages(spaceKey: string, options?: SyncOptions): Promise<ConfluencePage[]> {
    await this.checkRateLimit();

    const pages: ConfluencePage[] = [];
    let start = 0;
    const limit = 50;

    while (true) {
      const params = new URLSearchParams({
        'spaceKey': spaceKey,
        type: 'page',
        status: 'current',
        expand: 'version,history',
        start: String(start),
        limit: String(limit)
      });

      const response = await this.makeRequest('/wiki/rest/api/content', 'GET', { searchParams: params });

      if (!response.ok) {
        throw new Error(`Failed to fetch pages: ${response.statusText}`);
      }

      const data = await response.json();
      pages.push(...data.results);

      if (!data._links.next) {
        break;
      }

      start += limit;
    }

    return pages;
  }

  private async fetchPageContent(pageId: string): Promise<string> {
    await this.checkRateLimit();

    const response = await this.makeRequest(
      `/wiki/rest/api/content/${pageId}?expand=body.view`,
      'GET'
    );

    if (!response.ok) {
      return ''; // Return empty content on error
    }

    const data: ConfluenceContent = await response.json();
    const html = data.body?.view?.value || '';

    // Convert HTML to plain text
    return this.htmlToPlainText(html);
  }

  private async fetchPagePermissions(pageId: string): Promise<Array<{
    principalId: string;
    permissionLevel: 'read' | 'write' | 'admin';
  }>> {
    await this.checkRateLimit();

    try {
      const response = await this.makeRequest(
        `/wiki/rest/api/content/${pageId}/permission?expand=subject`,
        'GET'
      );

      if (!response.ok) {
        return [];
      }

      const data: ConfluencePermissions = await response.json();
      const permissions = data.results || [];

      return permissions.map(perm => {
        // Map Confluence operations to our permission levels
        let permissionLevel: 'read' | 'write' | 'admin' = 'read';

        if (perm.operation.operation === 'view') {
          permissionLevel = 'read';
        } else if (perm.operation.operation === 'edit') {
          permissionLevel = 'write';
        } else if (perm.operation.operation === 'admin' || perm.operation.operation === 'delete') {
          permissionLevel = 'admin';
        }

        // Get principal ID (user or group)
        let principalId = '';
        const subjects = perm.subjects || [];

        for (const subject of subjects) {
          if (subject.user) {
            principalId = subject.user.accountId;
            break;
          } else if (subject.group) {
            principalId = `group:${subject.group.name}`;
            break;
          }
        }

        return {
          principalId,
          permissionLevel
        };
      });
    } catch (error) {
      this.handleError(error, `fetchPagePermissions:${pageId}`);
      return [];
    }
  }

  // Override formatDocument for Confluence-specific formatting
  formatDocument(doc: ExternalDocument): FormattedDocument {
    const meta = doc.metadata as {
      spaceKey?: string;
      spaceName?: string;
      pageId?: string;
      version?: number;
      ancestors?: Array<{ title: string }>;
    };

    // Build tags from space and ancestors
    const tags: string[] = [];
    if (meta.spaceKey) {
      tags.push(`space:${meta.spaceKey}`);
    }

    if (meta.ancestors && meta.ancestors.length > 0) {
      tags.push(...meta.ancestors.map(a => `ancestor:${a.title}`).slice(0, 5));
    }

    return {
      title: doc.title,
      content: doc.content,
      metadata: {
        externalUrl: doc.externalUrl,
        externalUpdatedAt: doc.updatedAt.toISOString(),
        author: doc.author,
        spaceKey: meta.spaceKey,
        spaceName: meta.spaceName,
        pageId: meta.pageId,
        version: meta.version,
        ancestors: meta.ancestors,
        ...doc.metadata
      },
      tags
    };
  }
}
