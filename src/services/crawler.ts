import axios from 'axios';
import { HtmlParser } from '../utils/htmlParser';
import { HttpHelper } from '../services/httpHelper';
import { config } from '../config';

export class Crawler {
    private visitedUrls: Set<string>;
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.visitedUrls = new Set();
        console.log(`[Crawler] baseUrl=${this.baseUrl} MAX_DEPTH=${config.MAX_DEPTH} MAX_PAGES=${config.MAX_PAGES}`);
    }

    public async crawl(sourceUrl: string, currentDepth: number = 0): Promise<void> {
        const ts = () => new Date().toISOString();

        // Global cap: stop if we've already visited the maximum number of URLs
        if (this.visitedUrls.size >= config.MAX_PAGES) {
            console.log(`[${ts()}] [LIMIT] Global crawl limit reached: visited ${this.visitedUrls.size} >= ${config.MAX_PAGES}. Stopping.`);
            return;
        }

        // Also enforce a per-branch depth limit to avoid deep recursion
        if (currentDepth >= config.MAX_DEPTH) {
            console.log(`Depth limit reached: depth ${currentDepth} >= ${config.MAX_DEPTH}. Stopping this branch.`);
            return;
        }

        if (this.visitedUrls.has(sourceUrl)) {
            console.log(`[${ts()}] [SKIP] Already visited: ${sourceUrl} (depth ${currentDepth})`);
            return;
        }

        // Log start
        console.log(`[${ts()}] [START] depth=${currentDepth} visited=${this.visitedUrls.size} url=${sourceUrl}`);
        this.visitedUrls.add(sourceUrl);

        try {
            const startedAt = Date.now();
            const content = await HttpHelper.fetchHtml(sourceUrl);
            const {
                title,
                cleanedContent,
                otherPageUrls
            } = HtmlParser.extractRelevantContentFromHtml(content, this.baseUrl);
            
            const tookMs = Date.now() - startedAt;
            console.log(`[${ts()}] [RESULT] url=${sourceUrl} linksFound=${otherPageUrls.length} fetchMs=${tookMs} visited=${this.visitedUrls.size} remainingQuota=${Math.max(0, config.MAX_PAGES - this.visitedUrls.size)}`);
            for (const nextUrl of otherPageUrls) {
                if (this.visitedUrls.size >= config.MAX_PAGES) {
                    console.log(`[${ts()}] [LIMIT] Global crawl limit reached during link processing: visited ${this.visitedUrls.size} >= ${config.MAX_PAGES}. Halting further links.`);
                    break;
                }
                await this.crawl(nextUrl, currentDepth + 1);
            }
        } catch (error: any) {
            console.error(`[${new Date().toISOString()}] [ERROR] Failed to fetch ${sourceUrl}:`, error?.stack ?? error?.message ?? error);
        }
    }
}