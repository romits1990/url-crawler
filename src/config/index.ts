export const config = {
    MAX_DEPTH: parseInt(process.env.MAX_DEPTH ?? process.env.RECURSION_LIMIT ?? '3', 10),
    MAX_PAGES: parseInt(process.env.MAX_PAGES ?? process.env.MAX_PAGES_LIMIT ?? '3', 10)
};

export const EVENT_TYPES = {
    CRAWL_STARTED: 'crawl:started',
    CRAWL_COMPLETED: 'crawl:completed',
    CRAWL_ERROR: 'crawl:error',
    PAGE_PROCESSED: 'page:processed',
    PAGE_ERROR: 'page:error'
};