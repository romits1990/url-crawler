import { EventEmitter } from 'events';
import { HtmlParser } from '../utils/htmlParser';
import { HttpHelper } from '../services/httpHelper';
import { config, EVENT_TYPES } from '../config';
import { ParsedContentDetails } from '../types';

export class Crawler extends EventEmitter {
    private visitedUrls: Set<string>;
    private sourceUrl: string;
    private baseUrl: string;

    constructor(sourceUrl: string, configOverrides: Partial<typeof config> = {}) {
        super();
        this.sourceUrl = sourceUrl;
        this.baseUrl = HttpHelper.getBaseUrl(sourceUrl);
        this.visitedUrls = new Set();
        configOverrides && Object.assign(config, configOverrides);
        console.log(`[Crawler] baseUrl=${this.baseUrl} MAX_DEPTH=${config.MAX_DEPTH} MAX_PAGES=${config.MAX_PAGES}`);
    }

    public async startCrawl(): Promise<void> {
        const startTime = Date.now();
        
        this.visitedUrls.clear();
        this.emit(EVENT_TYPES.CRAWL_STARTED, { url: this.sourceUrl, timestamp: startTime });

        try {
            await this._crawl(this.sourceUrl, 0);

            // Emit the final "crawl completed" event
            this.emit(EVENT_TYPES.CRAWL_COMPLETED, {
                url: this.sourceUrl,
                totalPages: this.visitedUrls.size,
                durationMs: Date.now() - startTime
            });
        } catch (error: any) {
            // Emit a critical error if the entire crawl fails
            this.emit(EVENT_TYPES.CRAWL_ERROR, { 
                url: this.sourceUrl, message: error.message 
            });
            console.error(`[CRITICAL] Crawl failed for ${this.sourceUrl}:`, error.message);
        }
    }

    private async _crawl(pageUrl: string, currentDepth: number = 0): Promise<void> {
        const ts = () => new Date().toISOString();
        
        // --- Limit Checks ---
        if (this.visitedUrls.size >= config.MAX_PAGES) {
            return;
        }

        if (currentDepth >= config.MAX_DEPTH) {
            console.log(`[${ts()}] [LIMIT] Depth limit reached: ${currentDepth}. Stopping this branch.`);
            return;
        }

        if (this.visitedUrls.has(pageUrl)) {
            console.log(`[${ts()}] [SKIP] Already visited: ${pageUrl} (depth ${currentDepth})`);
            return;
        }
        
        // Add to visited set *before* fetching to prevent race conditions in parallel crawling
        this.visitedUrls.add(pageUrl); 
        console.log(`[${ts()}] [START] depth=${currentDepth} visited=${this.visitedUrls.size} url=${pageUrl}`);

        try {
            const startedAt = Date.now();
            const content = await HttpHelper.fetchHtml(pageUrl);
            const { title, cleanedContent, otherPageUrls }: ParsedContentDetails = HtmlParser.extractRelevantContentFromHtml(content, this.baseUrl);
            const tookMs = Date.now() - startedAt;
            
            this.emit(EVENT_TYPES.PAGE_PROCESSED, {
                url: pageUrl,
                title,
                content: cleanedContent
            });

            console.log(`[${ts()}] [EMIT] url=${pageUrl} linksFound=${otherPageUrls.length} fetchMs=${tookMs}`);
            
            const crawlPromises: Promise<void>[] = [];
            
            for (const nextUrl of otherPageUrls) {
                // Check limits again before launching new crawl
                if (this.visitedUrls.size < config.MAX_PAGES && !this.visitedUrls.has(nextUrl)) {
                    crawlPromises.push(this._crawl(nextUrl, currentDepth + 1));
                }
            }
            
            // Wait for all newly spawned crawl operations to finish before returning
            await Promise.all(crawlPromises);

        } catch (error: any) {
            // Emit error for main application to log/handle without stopping the whole crawl
            this.emit(EVENT_TYPES.PAGE_ERROR, { url: pageUrl, message: error?.message });
            console.error(`[${ts()}] [ERROR] Page error on ${pageUrl}:`, error?.message);
        }
    }
}