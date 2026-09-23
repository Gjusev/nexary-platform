/**
 * Notion Connector
 * Imports pages and databases from Notion
 *
 * Features:
 * - API key authentication (Integration Token)
 * - Page and database browsing
 * - Block to markdown conversion
 * - Last edited time tracking
 * - Nested pages support
 * - Permission extraction
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

interface NotionConfig extends ConnectorAuthConfig {
  credentials: Record<string, unknown> & {
    type: 'api_key';
    apiKey: string; // Integration secret: secret_*
  };
}

interface NotionPage {
  id: string;
  object: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  properties: Record<string, unknown>;
  parent: {
    type: 'workspace' | 'page_id' | 'database_id';
    [key: string]: string;
  };
  url: string;
  created_by?: string;
  last_edited_by?: string;
}

interface NotionDatabase {
  id: string;
  object: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  title: Array<{
    type: string;
    text: { content: string };
  }>;
  parent: {
    type: 'workspace' | 'page_id';
    [key: string]: string;
  };
  url: string;
}

interface NotionBlock {
  id: string;
  object: 'block';
  type: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  has_children: boolean;
  [key: string]: any; // Block-specific content
}

interface NotionUser {
  id: string;
  object: 'user';
  type: 'person' | 'bot';
  name?: string;
  avatar_url?: string;
  person?: {
    email: string;
  };
}

interface NotionSearchResponse {
  object: 'list';
  results: Array<NotionPage | NotionDatabase>;
  next_cursor: string | null;
}

interface NotionBlockResponse {
  object: 'list';
  results: NotionBlock[];
  next_cursor: string | null;
}

interface NotionChildrenResponse {
  object: 'list';
  results: Array<NotionPage | NotionBlock>;
  next_cursor: string | null;
}

export class NotionConnector extends BaseConnector {
  readonly sourceType = 'notion' as const;

  protected config: NotionConfig;
  private baseUrl = 'https://api.notion.com/v1';
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly REQUEST_LIMIT = 3; // 3 requests per second (tier 1)
  private readonly REQUEST_WINDOW = 1000; // 1 second in ms
  private readonly NOTION_VERSION = '2022-06-28';

  constructor(config: ConnectorAuthConfig, dataSourceId: string) {
    super(config, dataSourceId);
    this.config = config as unknown as NotionConfig;
  }

  // ========== Authentication ==========

  async authenticate(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/users/me', 'GET');
      return response.ok;
    } catch (error) {
      this.handleError(error, 'authenticate');
      return false;
    }
  }

  async refreshCredentials(): Promise<void> {
    // Notion uses API keys, no refresh needed
    throw new Error('Notion uses API key authentication, no refresh token available');
  }

  async validateConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('/users/me', 'GET');
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
    const since = options.since;

    // Search for all pages
    const pages = await this.fetchAllPages(since);

    for (const page of pages) {
      try {
        // Get page content as markdown
        const content = await this.fetchPageContent(page.id);

        // Get page creator/last editor info
        const user = await this.getPageUserInfo(page.id);

        documents.push({
          externalId: page.id,
          externalUrl: page.url,
          title: this.extractPageTitle(page),
          content,
          contentType: 'text/markdown',
          author: {
            id: user?.id,
            name: user?.name,
            email: user?.person?.email
          },
          updatedAt: new Date(page.last_edited_time),
          metadata: {
            parentId: page.parent?.page_id || page.parent?.database_id,
            parentType: page.parent?.type,
            archived: page.archived,
            createdAt: page.created_time,
            pageId: page.id
          },
          permissions: [] // Notion permissions are workspace-wide
        });
      } catch (error) {
        this.handleError(error, `fetchDocuments:page:${page.id}`);
      }
    }

    return documents;
  }

  async fetchDocument(externalId: string): Promise<ExternalDocument | null> {
    await this.checkRateLimit();

    try {
      const response = await this.makeRequest(`/pages/${externalId}`, 'GET');

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch page: ${response.statusText}`);
      }

      const page: NotionPage = await response.json();
      const content = await this.fetchPageContent(page.id);
      const user = await this.getPageUserInfo(page.id);

      return {
        externalId: page.id,
        externalUrl: page.url,
        title: this.extractPageTitle(page),
        content,
        contentType: 'text/markdown',
        author: {
          id: user?.id,
          name: user?.name,
          email: user?.person?.email
        },
        updatedAt: new Date(page.last_edited_time),
        metadata: {
          parentId: page.parent?.page_id || page.parent?.database_id,
          parentType: page.parent?.type,
          archived: page.archived,
          createdAt: page.created_time,
          pageId: page.id
        },
        permissions: []
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

    const since = options.since;
    const pages = await this.fetchAllPages(since);

    for (const page of pages) {
      documents.push({
        externalId: page.id,
        title: this.extractPageTitle(page),
        updatedAt: new Date(page.last_edited_time),
        url: page.url
      });
    }

    return documents;
  }

  // ========== Change Detection ==========

  async getChanges(since: Date): Promise<DocumentChange[]> {
    await this.checkRateLimit();

    const changes: DocumentChange[] = [];
    const pages = await this.fetchAllPages(since);

    for (const page of pages) {
      const pageDate = new Date(page.last_edited_time);

      if (pageDate > since) {
        changes.push({
          externalId: page.id,
          changeType: 'updated',
          timestamp: pageDate,
          newVersion: page.last_edited_time
        });
      }
    }

    return changes;
  }

  // ========== Webhooks ==========

  supportsWebhooks(): boolean {
    // Notion has limited webhook support (beta feature)
    return false;
  }

  async setupWebhook(endpointUrl: string): Promise<string> {
    throw new Error('Notion webhooks are not yet supported');
  }

  async handleWebhook(event: WebhookEvent): Promise<ExternalDocument | null> {
    throw new Error('Notion webhooks are not yet supported');
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    throw new Error('Notion webhooks are not yet supported');
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
      console.warn(`Notion rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }

    this.requestCount++;
  }

  // ========== Error Handling ==========

  protected handleError(error: unknown, context: string): void {
    console.error(`[Notion Connector] Error in ${context}:`, error);
  }

  // ========== Private Helper Methods ==========

  private async makeRequest(
    path: string,
    method: string = 'GET',
    body?: any
  ): Promise<Response> {
    await this.checkRateLimit();

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.credentials.apiKey}`,
      'Notion-Version': this.NOTION_VERSION,
      'Content-Type': 'application/json'
    };

    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle rate limiting (429)
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 1000;
      console.warn(`Notion rate limit hit. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.makeRequest(path, method, body);
    }

    return response;
  }

  private async fetchAllPages(since?: Date): Promise<NotionPage[]> {
    await this.checkRateLimit();

    const pages: NotionPage[] = [];
    let hasMore = true;
    let nextCursor: string | null = null;

    while (hasMore) {
      const body: any = {
        filter: {
          value: 'page',
          property: 'object'
        }
      };

      // Filter by last edited time for incremental sync
      if (since) {
        body.filter = {
          and: [
            {
              value: 'page',
              property: 'object'
            },
            {
              timestamp: 'last_edited_time',
              last_edited_time: {
                after: since.toISOString()
              }
            }
          ]
        };
      }

      if (nextCursor) {
        body.start_cursor = nextCursor;
      }

      const response = await this.makeRequest('/search', 'POST', body);

      if (!response.ok) {
        throw new Error(`Failed to search pages: ${response.statusText}`);
      }

      const data: NotionSearchResponse = await response.json();

      // Filter out archived pages
      for (const result of data.results) {
        if (result.object === 'page' && !result.archived) {
          pages.push(result as NotionPage);
        }
      }

      nextCursor = data.next_cursor;
      hasMore = nextCursor !== null;
    }

    return pages;
  }

  private async fetchPageContent(pageId: string): Promise<string> {
    await this.checkRateLimit();

    const blocks: NotionBlock[] = [];
    let hasMore = true;
    let nextCursor: string | null = null;

    // Fetch all blocks recursively
    while (hasMore) {
      const url = `/blocks/${pageId}/children${nextCursor ? `?start_cursor=${nextCursor}` : ''}`;
      const response = await this.makeRequest(url, 'GET');

      if (!response.ok) {
        throw new Error(`Failed to fetch page blocks: ${response.statusText}`);
      }

      const data: NotionBlockResponse = await response.json();
      blocks.push(...data.results);

      // Fetch children blocks for nested content
      for (const block of data.results) {
        if (block.has_children && !block.archived) {
          const childBlocks = await this.fetchChildBlocks(block.id);
          blocks.push(...childBlocks);
        }
      }

      nextCursor = data.next_cursor;
      hasMore = nextCursor !== null;
    }

    // Convert blocks to markdown
    return this.blocksToMarkdown(blocks);
  }

  private async fetchChildBlocks(blockId: string): Promise<NotionBlock[]> {
    await this.checkRateLimit();

    const blocks: NotionBlock[] = [];
    let hasMore = true;
    let nextCursor: string | null = null;

    while (hasMore) {
      const url = `/blocks/${blockId}/children${nextCursor ? `?start_cursor=${nextCursor}` : ''}`;
      const response = await this.makeRequest(url, 'GET');

      if (!response.ok) {
        // If we can't fetch children, continue without them
        break;
      }

      const data: NotionBlockResponse = await response.json();
      blocks.push(...data.results.filter(b => !b.archived));

      // Recursively fetch nested children
      for (const block of data.results) {
        if (block.has_children && !block.archived) {
          const childBlocks = await this.fetchChildBlocks(block.id);
          blocks.push(...childBlocks);
        }
      }

      nextCursor = data.next_cursor;
      hasMore = nextCursor !== null;
    }

    return blocks;
  }

  private blocksToMarkdown(blocks: NotionBlock[]): string {
    const lines: string[] = [];

    for (const block of blocks) {
      const markdown = this.blockToMarkdown(block);
      if (markdown) {
        lines.push(markdown);
      }
    }

    return lines.join('\n\n');
  }

  private blockToMarkdown(block: NotionBlock): string | null {
    if (block.archived) return null;

    switch (block.type) {
      case 'paragraph':
        return this.richTextToMarkdown(block.paragraph?.rich_text || []);

      case 'heading_1':
        return `# ${this.richTextToMarkdown(block.heading_1?.rich_text || [])}`;

      case 'heading_2':
        return `## ${this.richTextToMarkdown(block.heading_2?.rich_text || [])}`;

      case 'heading_3':
        return `### ${this.richTextToMarkdown(block.heading_3?.rich_text || [])}`;

      case 'bulleted_list_item':
        return `- ${this.richTextToMarkdown(block.bulleted_list_item?.rich_text || [])}`;

      case 'numbered_list_item':
        return `1. ${this.richTextToMarkdown(block.numbered_list_item?.rich_text || [])}`;

      case 'to_do':
        const checked = block.to_do?.checked ? '[x]' : '[ ]';
        return `- ${checked} ${this.richTextToMarkdown(block.to_do?.rich_text || [])}`;

      case 'toggle':
        return `<details>\n<summary>${this.richTextToMarkdown(block.toggle?.rich_text || [])}</summary>\n\n</details>`;

      case 'code':
        const language = block.code?.language || '';
        const code = this.richTextToMarkdown(block.code?.rich_text || [], true);
        return `\`\`\`${language}\n${code}\n\`\`\``;

      case 'quote':
        return `> ${this.richTextToMarkdown(block.quote?.rich_text || [])}`;

      case 'divider':
        return '---';

      case 'callout':
        const emoji = block.callout?.icon?.emoji || '';
        return `> ${emoji} ${this.richTextToMarkdown(block.callout?.rich_text || [])}`;

      case 'table':
        // Tables are complex, just note they exist
        return '[Table]';

      case 'image':
        const imageUrl = block.image?.type === 'external'
          ? block.image.external.url
          : block.image?.file?.url;
        return `![Image](${imageUrl})`;

      case 'video':
        const videoUrl = block.video?.type === 'external'
          ? block.video.external.url
          : block.video?.file?.url;
        return `[Video](${videoUrl})`;

      case 'file':
        const fileUrl = block.file?.type === 'external'
          ? block.file.external.url
          : block.file?.file?.url;
        return `[File](${fileUrl})`;

      case 'pdf':
        const pdfUrl = block.pdf?.type === 'external'
          ? block.pdf.external.url
          : block.pdf?.file?.url;
        return `[PDF](${pdfUrl})`;

      case 'bookmark':
        return `[${block.bookmark?.caption || 'Link'}](${block.bookmark?.url})`;

      case 'link_preview':
        return `[Link Preview](${block.link_preview?.url})`;

      case 'synced_block':
        return '[Synced Block]';

      case 'template':
        return `[Template: ${this.richTextToMarkdown(block.template?.rich_text || [])}]`;

      case 'link_to_page':
        return `[Link to Page]`;

      case 'child_page':
        return `## ${block.child_page?.title || 'Child Page'}`;

      case 'child_database':
        return `[Database: ${block.child_database?.title || 'Untitled'}]`;

      case 'column_list':
        return '[Column Layout]';

      default:
        return null;
    }
  }

  private richTextToMarkdown(richText: any[], preserveWhitespace = false): string {
    if (!richText || richText.length === 0) return '';

    return richText.map((text: any) => {
      let content = text.plain_text || '';

      if (!preserveWhitespace) {
        content = content.replace(/\s+/g, ' ').trim();
      }

      // Handle formatting
      if (text.annotations?.code) {
        content = `\`${content}\``;
      }
      if (text.annotations?.bold) {
        content = `**${content}**`;
      }
      if (text.annotations?.italic) {
        content = `_${content}_`;
      }
      if (text.annotations?.strikethrough) {
        content = `~~${content}~~`;
      }
      if (text.annotations?.underline) {
        content = `<u>${content}</u>`;
      }

      // Handle links
      if (text.href) {
        content = `[${content}](${text.href})`;
      }

      // Handle equations
      if (text.type === 'equation') {
        content = `$${text.equation?.expression || content}$`;
      }

      return content;
    }).join('');
  }

  private extractPageTitle(page: NotionPage): string {
    // Try to get title from Name or Title property
    const nameProperty = page.properties?.Name || page.properties?.title || page.properties?.Title;

    if (nameProperty && typeof nameProperty === 'object' && nameProperty !== null) {
      const prop = nameProperty as Record<string, unknown>;
      if (prop.type === 'title') {
        const titleArray = prop.title as Array<{ plain_text?: string }> | undefined;
        if (titleArray && titleArray.length > 0 && titleArray[0].plain_text) {
          return titleArray[0].plain_text;
        }
      }
      if (prop.type === 'rich_text') {
        const richTextArray = prop.rich_text as Array<{ plain_text?: string }> | undefined;
        if (richTextArray && richTextArray.length > 0 && richTextArray[0].plain_text) {
          return richTextArray[0].plain_text;
        }
      }
    }

    return 'Untitled';
  }

  private async getPageUserInfo(pageId: string): Promise<NotionUser | null> {
    try {
      const response = await this.makeRequest(`/pages/${pageId}`, 'GET');
      if (!response.ok) {
        return null;
      }

      const page: NotionPage = await response.json();
      const createdBy = page.created_by as string;
      const lastEditedBy = page.last_edited_by as string;

      // Fetch the user who last edited the page
      if (lastEditedBy) {
        const userResponse = await this.makeRequest(`/users/${lastEditedBy}`, 'GET');
        if (userResponse.ok) {
          return await userResponse.json();
        }
      }

      return null;
    } catch (error) {
      this.handleError(error, `getPageUserInfo:${pageId}`);
      return null;
    }
  }

  // Override formatDocument for Notion-specific formatting
  formatDocument(doc: ExternalDocument): FormattedDocument {
    const meta = doc.metadata as {
      parentId?: string;
      parentType?: string;
      pageId?: string;
      archived?: boolean;
    };

    // Build tags from parent info
    const tags: string[] = [];

    if (meta.parentType === 'page_id') {
      tags.push('type:subpage');
    } else if (meta.parentType === 'database_id') {
      tags.push('type:database_page');
    } else if (meta.parentType === 'workspace') {
      tags.push('type:root_page');
    }

    if (meta.parentId) {
      tags.push(`parent:${meta.parentId}`);
    }

    return {
      title: doc.title,
      content: doc.content,
      metadata: {
        externalUrl: doc.externalUrl,
        externalUpdatedAt: doc.updatedAt.toISOString(),
        author: doc.author,
        parentId: meta.parentId,
        parentType: meta.parentType,
        pageId: meta.pageId,
        archived: meta.archived,
        ...doc.metadata
      },
      tags
    };
  }
}
