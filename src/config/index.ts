import { Config } from "../types";

export const config: Config = {
    MAX_DEPTH: parseInt(process.env.MAX_DEPTH ?? process.env.RECURSION_LIMIT ?? '3', 10),
    MAX_PAGES: parseInt(process.env.MAX_PAGES ?? process.env.MAX_PAGES_LIMIT ?? '3', 10),
    CRAWL_DELAY_MS: parseInt(process.env.CRAWL_DELAY_MS ?? '1000', 10) // default 1 second between requests per host
};

// TTL for robots.txt cache entries in milliseconds. Defaults to 24 hours.
export const ROBOTS_CACHE_TTL_MS = parseInt(process.env.ROBOTS_CACHE_TTL_MS ?? String(24 * 60 * 60 * 1000), 10);
export const EVENT_TYPES = {
    CRAWL_STARTED: 'crawl:started',
    CRAWL_COMPLETED: 'crawl:completed',
    CRAWL_ERROR: 'crawl:error',
    PAGE_PROCESSED: 'page:processed',
    PAGE_ERROR: 'page:error'
};

export const CRAWLER_USER_AGENT = "url-crawler/1.0.0 (+https://github.com/YourRepo/url-crawler)";