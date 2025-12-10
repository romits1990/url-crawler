// Just crawler
import { Crawler } from './src/entries/crawler';

// Just types
import type { 
    CrawlStartedEventPayload,
    CrawlCompletedEventPayload,
    CrawlErrorEventPayload,
    PageProcessedEventPayload,
    PageErrorEventPayload,
    EventData
 } from './src/entries/types';

// Just config
import { EVENT_TYPES } from './src/entries/config';

const testUrl = "https://www.scrapethissite.com/pages/";
const configOverrides = {
    MAX_DEPTH: 2,
    MAX_PAGES: 10
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
    console.log(`[CALLBACK] Page processed: ${data.url} | Title: ${data.title}`);
});

// crawler.on(EVENT_TYPES.PAGE_ERROR, (eventData: EventData) => {
//     const data = eventData as PageErrorEventPayload;
//     console.error(`[CALLBACK] Error processing page ${data.url}: ${data.message}`);
// });

crawler.startCrawl();


