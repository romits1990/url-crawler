import { Crawler } from './dist';

import type { 
    CrawlStartedEventPayload,
    CrawlCompletedEventPayload,
    CrawlErrorEventPayload,
    PageProcessedEventPayload,
    PageErrorEventPayload,
    EventData
 } from './dist';

// Just config
import { EVENT_TYPES } from './dist';

const testUrl = "https://www.scrapethissite.com/pages/";
const configOverrides = {
    MAX_DEPTH: 2,
    MAX_PAGES: 10,
    CRAWL_DELAY_MS: 2000
};
const crawler = new Crawler(testUrl, configOverrides);

// crawler.on(EVENT_TYPES.CRAWL_STARTED, (eventData: EventData) => {
//     const data = eventData as CrawlStartedEventPayload;
//     console.log(`[CALLBACK] Crawl started for ${data.url} at ${new Date(data.timestamp).toISOString()}`);
// });

crawler.on(EVENT_TYPES.CRAWL_COMPLETED, (eventData: EventData) => {
    const data = eventData as CrawlCompletedEventPayload;
    console.log(`[CALLBACK] Crawl completed for ${data.url}. Total pages: ${data.totalPages}. Duration: ${data.durationMs}ms`);
});

// crawler.on(EVENT_TYPES.CRAWL_ERROR, (eventData: EventData) => {
//     const data = eventData as CrawlErrorEventPayload;
//     console.error(`[CALLBACK] Crawl error for ${data.url}: ${data.message}`);
// });

crawler.on(EVENT_TYPES.PAGE_PROCESSED, (eventData: EventData) => {
    const data = eventData as PageProcessedEventPayload;
    const host = new URL(data.url).host;
    const now = Date.now();
    // track last processed timestamp per host to observe crawl-delay enforcement
    (globalThis as any).__lastHostTs = (globalThis as any).__lastHostTs || {};
    const lastHostTs: Record<string, number> = (globalThis as any).__lastHostTs;
    const last = lastHostTs[host] ?? 0;
    if (last) {
        console.log(`[TIMING] host=${host} deltaMs=${now - last}`);
    }
    lastHostTs[host] = now;
    console.log(`[CALLBACK] Page processed: ${data.url} | Title: ${data.title}`);
});

// crawler.on(EVENT_TYPES.PAGE_ERROR, (eventData: EventData) => {
//     const data = eventData as PageErrorEventPayload;
//     console.error(`[CALLBACK] Error processing page ${data.url}: ${data.message}`);
// });

crawler.startCrawl();


