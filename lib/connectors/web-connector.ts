/**
 * Web Scraper Connector
 * Scrapes web pages and converts them to documents
 *
 * Features:
 * - Multiple URL support
 * - Configurable crawl depth
 * - Domain filtering
 * - Link following
 * - Rate limiting for polite crawling
 * - HTML to plain text conversion
 * - Metadata extraction (title, description, author)
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

interface WebConfig extends ConnectorAuthConfig {
  type: 'none';
  credentials: Record<string, never>;
  urls: string[];
  maxDepth?: number; // Default: 1 (only seed pages)
  maxPages?: number; // Default: 100
  allowedDomains?: string[]; // If empty, allow all domains
  excludePatterns?: string[]; // URL patterns to exclude (regex)
  includePatterns?: string[]; // URL patterns to include (regex)
  followLinks?: boolean; // Default: false
  respectRobotsTxt?: boolean; // Default: true
  userAgent?: string; // Custom user agent
  timeout?: number; // Request timeout in ms (default: 30000)
}

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  description?: string;
  author?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
  links: string[];
  depth: number;
  statusCode: number;
}

interface CrawlQueue {
  url: string;
  depth: number;
  referredBy?: string;
}

interface RobotsTxtRule {
  userAgent: string | '*';
  allow: string[];
  disallow: string[];
  crawlDelay?: number;
}

export class WebConnector extends BaseConnector {
  readonly sourceType = 'web' as const;

  protected config: WebConfig;
  private requestCount = 0;
  private requestWindowStart = Date.now();
  private readonly REQUEST_LIMIT = 1; // 1 request per second (polite)
  private readonly REQUEST_WINDOW = 1000; // 1 second in ms
  private crawledUrls = new Set<string>();
  private robotsTxtCache = new Map<string, RobotsTxtRule[]>();

  constructor(config: ConnectorAuthConfig, dataSourceId: string) {
    super(config, dataSourceId);
    this.config = config as unknown as WebConfig;
  }

  // ========== Authentication ==========

  async authenticate(): Promise<boolean> {
    // Web scraping doesn't require authentication
    return true;
  }

  async refreshCredentials(): Promise<void> {
    // No credentials to refresh
    throw new Error('Web scraping does not use credentials');
  }

  async validateConnection(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      if (!this.config.urls || this.config.urls.length === 0) {
        return { healthy: false, error: 'No URLs configured' };
      }

      // Test connection by fetching the first URL
      const testUrl = this.config.urls[0];
      const response = await fetch(testUrl, {
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      });
      const latency = Date.now() - startTime;

      if (response.ok) {
        return { healthy: true, latency };
      }

      return { healthy: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (error) {
      return { healthy: false, error: String(error) };
    }
  }

  // ========== Document Fetching ==========

  async fetchDocuments(options: SyncOptions): Promise<ExternalDocument[]> {
    await this.checkRateLimit();

    const documents: ExternalDocument[] = [];
    const maxDepth = this.config.maxDepth ?? 1;
    const maxPages = this.config.maxPages ?? 100;
    const since = options.since;

    // Reset crawled URLs for each sync
    this.crawledUrls.clear();

    // Initialize crawl queue with seed URLs
    const queue: CrawlQueue[] = this.config.urls.map(url => ({
      url: this.normalizeUrl(url),
      depth: 0
    }));

    let pageCount = 0;

    while (queue.length > 0 && pageCount < maxPages) {
      const { url, depth } = queue.shift()!;

      // Skip if already crawled
      if (this.crawledUrls.has(url)) {
        continue;
      }

      // Skip if depth exceeded
      if (depth > maxDepth) {
        continue;
      }

      // Check if URL should be crawled
      if (!this.shouldCrawlUrl(url)) {
        continue;
      }

      // Check robots.txt
      if (this.config.respectRobotsTxt !== false) {
        const allowed = await this.isAllowedByRobotsTxt(url);
        if (!allowed) {
          continue;
        }
      }

      try {
        // Scrape the page
        const page = await this.scrapePage(url);

        if (!page || page.statusCode !== 200) {
          continue;
        }

        this.crawledUrls.add(url);
        pageCount++;

        // Filter by last updated for incremental sync
        // Since web pages don't have reliable timestamps, we skip this filter
        // and rely on checksums during document processing

        documents.push({
          externalId: this.generateExternalId(url),
          externalUrl: url,
          title: page.title,
          content: page.content,
          contentType: 'text/html',
          author: page.author ? { name: page.author } : undefined,
          updatedAt: new Date(), // Web pages don't always have dates
          metadata: {
            depth,
            description: page.description,
            keywords: page.keywords,
            ogImage: page.ogImage,
            canonicalUrl: page.canonicalUrl,
            linkCount: page.links.length,
            statusCode: page.statusCode
          },
          permissions: [] // Public web pages have no permissions
        });

        // Add links to queue if following links is enabled
        if (this.config.followLinks && depth < maxDepth) {
          for (const link of page.links) {
            const normalizedLink = this.normalizeUrl(link);
            if (!this.crawledUrls.has(normalizedLink) && this.shouldCrawlUrl(normalizedLink)) {
              queue.push({
                url: normalizedLink,
                depth: depth + 1,
                referredBy: url
              });
            }
          }
        }

        // Rate limiting between requests
        await this.checkRateLimit();
      } catch (error) {
        this.handleError(error, `fetchDocuments:url:${url}`);
      }
    }

    return documents;
  }

  async fetchDocument(externalId: string): Promise<ExternalDocument | null> {
    await this.checkRateLimit();

    try {
      // Reverse the external ID to get the URL
      const url = Buffer.from(externalId, 'base64').toString('utf-8');
      const page = await this.scrapePage(url);

      if (!page || page.statusCode !== 200) {
        return null;
      }

      return {
        externalId,
        externalUrl: url,
        title: page.title,
        content: page.content,
        contentType: 'text/html',
        author: page.author ? { name: page.author } : undefined,
        updatedAt: new Date(),
        metadata: {
          description: page.description,
          keywords: page.keywords,
          ogImage: page.ogImage,
          canonicalUrl: page.canonicalUrl,
          statusCode: page.statusCode
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

    // For web scraping, we just return the seed URLs
    // Full document listing would require crawling
    for (const url of this.config.urls) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(this.config.timeout || 30000)
        });

        if (response.ok) {
          const html = await response.text();
          const title = this.extractTitle(html);

          documents.push({
            externalId: this.generateExternalId(url),
            title: title || url,
            updatedAt: new Date(),
            url
          });
        }

        await this.checkRateLimit();
      } catch (error) {
        this.handleError(error, `listDocuments:url:${url}`);
      }
    }

    return documents;
  }

  // ========== Change Detection ==========

  async getChanges(since: Date): Promise<DocumentChange[]> {
    // Web scraping doesn't support reliable change detection
    // Return empty array - changes will be detected via checksums during sync
    return [];
  }

  // ========== Webhooks ==========

  supportsWebhooks(): boolean {
    return false;
  }

  async setupWebhook(endpointUrl: string): Promise<string> {
    throw new Error('Web scraping does not support webhooks');
  }

  async handleWebhook(event: WebhookEvent): Promise<ExternalDocument | null> {
    throw new Error('Web scraping does not support webhooks');
  }

  async deleteWebhook(webhookId: string): Promise<boolean> {
    throw new Error('Web scraping does not support webhooks');
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
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.requestWindowStart = Date.now();
    }

    this.requestCount++;
  }

  // ========== Error Handling ==========

  protected handleError(error: unknown, context: string): void {
    console.error(`[Web Connector] Error in ${context}:`, error);
  }

  // ========== Private Helper Methods ==========

  private async scrapePage(url: string): Promise<ScrapedPage | null> {
    await this.checkRateLimit();

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.config.userAgent || 'Mozilla/5.0 (compatible; NexaryAI-Bot/1.0)'
        },
        signal: AbortSignal.timeout(this.config.timeout || 30000)
      });

      if (!response.ok) {
        return {
          url,
          title: '',
          content: '',
          links: [],
          depth: 0,
          statusCode: response.status
        };
      }

      const html = await response.text();

      // Extract metadata
      const title = this.extractTitle(html);
      const description = this.extractMetaContent(html, 'description');
      const author = this.extractMetaContent(html, 'author');
      const keywords = this.extractMetaContent(html, 'keywords');
      const ogImage = this.extractMetaProperty(html, 'og:image');
      const canonicalUrl = this.extractLinkHref(html, 'canonical');

      // Extract content
      const content = this.extractContent(html);

      // Extract links
      const links = this.extractLinks(html, url);

      return {
        url,
        title,
        content,
        description,
        author,
        keywords,
        ogImage,
        canonicalUrl,
        links,
        depth: 0,
        statusCode: response.status
      };
    } catch (error) {
      this.handleError(error, `scrapePage:${url}`);
      return null;
    }
  }

  private extractTitle(html: string): string {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    if (titleMatch) {
      return this.htmlToPlainText(titleMatch[1]);
    }
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/is);
    if (ogTitleMatch) {
      return ogTitleMatch[1];
    }
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    if (h1Match) {
      return this.htmlToPlainText(h1Match[1]);
    }
    return 'Untitled';
  }

  private extractMetaContent(html: string, name: string): string | undefined {
    const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'is');
    const match = html.match(regex);
    return match?.[1];
  }

  private extractMetaProperty(html: string, property: string): string | undefined {
    const regex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'is');
    const match = html.match(regex);
    return match?.[1];
  }

  private extractLinkHref(html: string, rel: string): string | undefined {
    const regex = new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']+)["']`, 'is');
    const match = html.match(regex);
    return match?.[1];
  }

  private extractContent(html: string): string {
    // Remove script and style tags
    let content = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');

    // Try to extract main content areas
    const mainContentMatch = content.match(/<main[^>]*>(.*?)<\/main>/is);
    if (mainContentMatch) {
      return this.htmlToPlainText(mainContentMatch[1]);
    }

    const articleMatch = content.match(/<article[^>]*>(.*?)<\/article>/is);
    if (articleMatch) {
      return this.htmlToPlainText(articleMatch[1]);
    }

    const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/is);
    if (bodyMatch) {
      return this.htmlToPlainText(bodyMatch[1]);
    }

    return this.htmlToPlainText(content);
  }

  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];

      // Skip anchors, javascript, and mailto links
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        continue;
      }

      // Resolve relative URLs
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        links.push(absoluteUrl);
      } catch {
        // Invalid URL, skip
      }
    }

    return links;
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove fragment and trailing slash
      urlObj.hash = '';
      urlObj.pathname = urlObj.pathname.replace(/\/$/, '') || '/';
      return urlObj.href;
    } catch {
      return url;
    }
  }

  private generateExternalId(url: string): string {
    // Use base64 encoding of URL as external ID
    return Buffer.from(url, 'utf-8').toString('base64');
  }

  private shouldCrawlUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Check allowed domains
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        if (!this.config.allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`))) {
          return false;
        }
      }

      // Check exclude patterns
      if (this.config.excludePatterns) {
        for (const pattern of this.config.excludePatterns) {
          const regex = new RegExp(pattern);
          if (regex.test(url)) {
            return false;
          }
        }
      }

      // Check include patterns
      if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        let matchesInclude = false;
        for (const pattern of this.config.includePatterns) {
          const regex = new RegExp(pattern);
          if (regex.test(url)) {
            matchesInclude = true;
            break;
          }
        }
        if (!matchesInclude) {
          return false;
        }
      }

      // Only crawl HTTP/HTTPS
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return false;
      }

      // Skip common non-content file types
      const skipExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.zip', '.tar', '.gz'];
      if (skipExtensions.some(ext => urlObj.pathname.toLowerCase().endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async isAllowedByRobotsTxt(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;

      // Check cache first
      if (!this.robotsTxtCache.has(robotsUrl)) {
        await this.fetchRobotsTxt(robotsUrl);
      }

      const rules = this.robotsTxtCache.get(robotsUrl);
      if (!rules || rules.length === 0) {
        return true; // No restrictions
      }

      const userAgent = this.config.userAgent || '*';
      const path = urlObj.pathname;

      // Find matching rule (most specific first)
      const matchingRule = rules.find(rule =>
        rule.userAgent === '*' || userAgent.includes(rule.userAgent)
      );

      if (!matchingRule) {
        return true;
      }

      // Check disallow rules
      for (const disallow of matchingRule.disallow) {
        if (path.startsWith(disallow)) {
          return false;
        }
      }

      // Check allow rules (allow overrides disallow)
      for (const allow of matchingRule.allow) {
        if (path.startsWith(allow)) {
          return true;
        }
      }

      return true;
    } catch {
      return true; // Allow if we can't check robots.txt
    }
  }

  private async fetchRobotsTxt(robotsUrl: string): Promise<void> {
    try {
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': this.config.userAgent || 'Mozilla/5.0 (compatible; NexaryAI-Bot/1.0)'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout for robots.txt
      });

      if (!response.ok) {
        this.robotsTxtCache.set(robotsUrl, []); // No restrictions if 404
        return;
      }

      const content = await response.text();
      const rules = this.parseRobotsTxt(content);
      this.robotsTxtCache.set(robotsUrl, rules);
    } catch {
      this.robotsTxtCache.set(robotsUrl, []); // No restrictions on error
    }
  }

  private parseRobotsTxt(content: string): RobotsTxtRule[] {
    const rules: RobotsTxtRule[] = [];
    let currentRule: RobotsTxtRule | null = null;

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }

      // Parse user-agent
      if (trimmedLine.toLowerCase().startsWith('user-agent:')) {
        if (currentRule) {
          rules.push(currentRule);
        }
        const userAgent = trimmedLine.substring(11).trim();
        currentRule = {
          userAgent,
          allow: [],
          disallow: []
        };
        continue;
      }

      // Parse disallow
      if (trimmedLine.toLowerCase().startsWith('disallow:')) {
        const path = trimmedLine.substring(9).trim();
        if (currentRule && path !== '') {
          currentRule.disallow.push(path);
        }
        continue;
      }

      // Parse allow
      if (trimmedLine.toLowerCase().startsWith('allow:')) {
        const path = trimmedLine.substring(6).trim();
        if (currentRule && path !== '') {
          currentRule.allow.push(path);
        }
        continue;
      }

      // Parse crawl-delay
      if (trimmedLine.toLowerCase().startsWith('crawl-delay:')) {
        const delay = parseInt(trimmedLine.substring(12).trim());
        if (currentRule && !isNaN(delay)) {
          currentRule.crawlDelay = delay;
        }
        continue;
      }
    }

    if (currentRule) {
      rules.push(currentRule);
    }

    return rules;
  }

  // Override formatDocument for Web-specific formatting
  formatDocument(doc: ExternalDocument): FormattedDocument {
    const meta = doc.metadata as {
      depth?: number;
      description?: string;
      keywords?: string;
      ogImage?: string;
      canonicalUrl?: string;
      linkCount?: number;
    };

    // Build tags from metadata
    const tags: string[] = ['type:web'];

    if (meta.depth !== undefined) {
      tags.push(`depth:${meta.depth}`);
    }

    if (meta.keywords) {
      const keywordTags = meta.keywords.split(',').map(k => k.trim()).slice(0, 5);
      tags.push(...keywordTags);
    }

    // Add domain tag
    try {
      const urlObj = new URL(doc.externalUrl || '');
      tags.push(`domain:${urlObj.hostname}`);
    } catch {
      // Invalid URL
    }

    return {
      title: doc.title,
      content: doc.content,
      metadata: {
        externalUrl: doc.externalUrl,
        externalUpdatedAt: doc.updatedAt.toISOString(),
        author: doc.author,
        description: meta.description,
        keywords: meta.keywords,
        ogImage: meta.ogImage,
        canonicalUrl: meta.canonicalUrl,
        linkCount: meta.linkCount,
        ...doc.metadata
      },
      tags
    };
  }
}
