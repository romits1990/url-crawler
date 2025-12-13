# URL Crawler Library

A TypeScript library for crawling and extracting cleaned HTML content from URLs. This library provides tools to fetch HTML content, parse it, extract links, and recursively crawl pages with configurable depth and page limits.

## Features

- **Event-Driven Crawling**: Built on Node.js EventEmitter for real-time progress tracking and error handling
- **Recursive URL Crawling**: Crawl URLs with configurable depth and page limits
- **Parallel Processing**: Efficiently crawl multiple pages concurrently
- **HTML Parsing**: Extract cleaned text content, titles, and links from HTML
- **HTML Cleaning**: Remove scripts, styles, and unnecessary whitespace using sanitize-html
- **Link Extraction**: Parse and normalize URLs found in HTML content
- **HTTP Fetching**: Robust HTTP helper for fetching HTML content with error handling
- **Race Condition Prevention**: Safe URL tracking to prevent duplicate crawls
- **Configurable Limits**: Control MAX_DEPTH and MAX_PAGES per-crawler instance
- **Robots.txt Support**: Automatic robots.txt compliance with crawl delay throttling
- **Per-Host Rate Limiting**: Respects crawl delays from robots.txt files using host-based throttling

## Installation

```bash
npm install url-crawler
```

## Import Patterns

The library exports the Crawler class, type definitions, and configuration:

```typescript
import { Crawler } from 'url-crawler';
import type { CrawlStartedEventPayload } from 'url-crawler';
import { EVENT_TYPES, config } from 'url-crawler';
```

## Usage

### Event-Driven Crawling

The `Crawler` class extends `EventEmitter` and provides event-driven crawling with proper error handling and progress tracking:

```typescript
import { Crawler } from 'url-crawler';

const crawler = new Crawler('https://example.com');

// Listen to crawl events
crawler.on('crawl:started', (data) => {
    console.log('Crawl started:', data);
});

crawler.on('page:processed', (data) => {
    console.log('Page processed:', data.url, data.title);
});

crawler.on('page:error', (data) => {
    console.log('Page error:', data.url, data.message);
});

crawler.on('crawl:completed', (data) => {
    console.log('Crawl completed. Total pages:', data.totalPages, 'Duration:', data.durationMs, 'ms');
});

crawler.on('crawl:error', (data) => {
    console.error('Critical crawl error:', data.message);
});

// Start crawling
await crawler.startCrawl();
```

### Configuration Overrides

Pass configuration overrides to customize behavior per-crawler instance:

```typescript
import { Crawler } from 'url-crawler';

const crawler = new Crawler('https://example.com', {
    MAX_DEPTH: 5,
    MAX_PAGES: 20
});

await crawler.startCrawl();
```

### HTML Parsing

```typescript
// HtmlParser is used internally by Crawler
// For custom HTML parsing, use the Crawler to fetch and process pages
const crawler = new Crawler('https://example.com');

crawler.on('page:processed', (data) => {
    const { url, title, cleanedContent, otherPageUrls } = data;
    console.log(title);
    console.log(cleanedContent);
    console.log(otherPageUrls);
});

await crawler.startCrawl();
```

### HTTP Fetching

```typescript
// HttpHelper is used internally by Crawler
// Use Crawler for HTTP operations with built-in rate limiting and robots.txt support
```

### Robots.txt Parser

```typescript
// RobotsTxtParser is used internally by Crawler
// Robots.txt checking is automatic - disallowed URLs are skipped during crawling
```

### Robots.txt Crawl Delay with Throttling

The crawler automatically respects the `Crawl-delay` directive specified in a website's `robots.txt` file. This feature ensures ethical crawling practices and prevents server overload:

```typescript
import { Crawler } from 'url-crawler';

const crawler = new Crawler('https://example.com');

// The crawler automatically:
// 1. Fetches the robots.txt file from the target domain
// 2. Extracts the Crawl-delay directive for the crawler's user agent
// 3. Applies per-host rate limiting based on the specified delay

crawler.on('page:processed', (data) => {
    console.log('Page crawled with respect to robots.txt crawl delay:', data.url);
});

await crawler.startCrawl();
```

**How It Works:**

- **robots.txt Fetching**: On first access to a domain, the crawler fetches and caches the `robots.txt` file from the host
- **Crawl Delay Extraction**: The `Crawl-delay` directive is parsed from the robots.txt file. If specified, this value (in seconds) determines the minimum delay between requests to that host
- **Per-Host Throttling**: Using the Bottleneck rate limiting library, each host maintains its own queue with a `minTime` interval set to the crawl delay value
- **Default Fallback**: If no `Crawl-delay` is specified in robots.txt, the crawler uses a default `CRAWL_DELAY_MS` (typically 1000ms) to avoid aggressive crawling
- **Caching**: robots.txt files are cached with a configurable TTL (default `ROBOTS_CACHE_TTL_MS`) to avoid repeated fetches

**Key Features:**

- **Single Concurrent Request per Host**: Only one request is made to each host at a time, ensuring sequential crawling
- **Robots.txt Compliance**: Disallowed URLs (as per robots.txt `Disallow` directives) are automatically skipped
- **Efficient Resource Usage**: Multiple hosts can be crawled in parallel, but each host respects its rate limits
- **Graceful Degradation**: If robots.txt cannot be fetched, the crawler proceeds with the default crawl delay

**Example robots.txt Entry:**

```
User-agent: *
Crawl-delay: 2
Disallow: /admin/
Disallow: /private/
```

In this example, the crawler will wait 2 seconds between requests to this domain and will not attempt to crawl `/admin/` or `/private/` URLs.

## Configuration

Configure the crawler behavior using environment variables:

- `MAX_DEPTH`: Maximum crawl depth (default: 3)
  - Alternative: `RECURSION_LIMIT`
- `MAX_PAGES`: Maximum number of pages to crawl (default: 3)
  - Alternative: `MAX_PAGES_LIMIT`
- `CRAWL_DELAY_MS`: Default delay between requests per host in milliseconds when robots.txt doesn't specify a crawl delay (default: 1000)
- `ROBOTS_CACHE_TTL_MS`: Time-to-live for robots.txt cache entries in milliseconds (default: 86400000 = 24 hours)

**Setting via Environment Variables:**

```bash
# Set maximum crawl depth
export MAX_DEPTH=5

# Set maximum pages to crawl
export MAX_PAGES=20

# Set default crawl delay (in milliseconds)
export CRAWL_DELAY_MS=2000

# Set robots.txt cache TTL (in milliseconds)
export ROBOTS_CACHE_TTL_MS=3600000  # 1 hour
```

**Accessing Configuration in Code:**

```typescript
import { config, ROBOTS_CACHE_TTL_MS } from 'url-crawler';

console.log(config.MAX_DEPTH);          // From MAX_DEPTH env var, or RECURSION_LIMIT fallback
console.log(config.MAX_PAGES);          // From MAX_PAGES env var, or MAX_PAGES_LIMIT fallback
console.log(config.CRAWL_DELAY_MS);     // From CRAWL_DELAY_MS env var
console.log(ROBOTS_CACHE_TTL_MS);       // From ROBOTS_CACHE_TTL_MS env var or 24 hour default
```

**Per-Instance Configuration Overrides:**

You can also override configuration for individual crawler instances without modifying environment variables:

```typescript
import { Crawler } from 'url-crawler';

const crawler = new Crawler('https://example.com', {
    MAX_DEPTH: 5,
    MAX_PAGES: 20,
    CRAWL_DELAY_MS: 2000
});

await crawler.startCrawl();
```

## Events

The `Crawler` class emits the following events:

- **`crawl:started`**: Emitted when crawling begins. Payload: `{ url, timestamp }`
- **`page:processed`**: Emitted when a page is successfully crawled. Payload: `{ url, title, content }`
- **`page:error`**: Emitted when a page fails to crawl. Payload: `{ url, message }`
- **`crawl:completed`**: Emitted when crawling completes successfully. Payload: `{ url, totalPages, durationMs }`
- **`crawl:error`**: Emitted when a critical crawl error occurs. Payload: `{ url, message }`

## Available Exports

The library exports:

- `Crawler` - The main web crawler class
- `EVENT_TYPES` - Event type constants for event listeners
- `config` - Configuration object with default values
- `ROBOTS_CACHE_TTL_MS` - Cache TTL for robots.txt
- `CRAWLER_USER_AGENT` - User agent string used for HTTP requests
- Type definitions: `CrawlStartedEventPayload`, `PageProcessedEventPayload`, `CrawlCompletedEventPayload`, `PageErrorEventPayload`, `CrawlErrorEventPayload`, `EventData`

All utility services (HtmlParser, HttpHelper, RobotsTxtParser) are used internally by the Crawler and not exposed as separate exports.

## Project Structure

```
src
├── index.ts              # Library entry point
├── config
│   └── index.ts          # Configuration and event types
├── entries
│   ├── crawler.ts        # Crawler export
│   ├── config.ts         # Config export
│   └── types.ts          # Types export
├── services
│   ├── crawler.ts        # Event-driven crawler implementation
│   ├── httpHelper.ts     # HTTP utilities (fetch, URL parsing)
│   └── robotsTxt.ts      # Robots.txt parsing and URL validation
├── types
│   └── index.ts          # TypeScript interfaces and types
└── utils
    └── htmlParser.ts     # HTML parsing and link extraction utilities
```

## Types

```typescript


type ParsedContentDetails = {
    title: string;
    cleanedContent: string;
    otherPageUrls: string[];
};
```

## Building

```bash
npm run build
```

This generates compiled JavaScript and TypeScript declaration files in the `dist` directory.

## License

This project is licensed under the MIT License.