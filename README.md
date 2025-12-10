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

## Installation

```bash
npm install url-crawler
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
import { HtmlParser } from 'url-crawler';

const html = '<html><body><a href="/page">Link</a></body></html>';
const parsed = HtmlParser.extractRelevantContentFromHtml(html, 'https://example.com');
console.log(parsed.title);
console.log(parsed.cleanedContent);
console.log(parsed.otherPageUrls);
```

### HTTP Helper

```typescript
import { HttpHelper } from 'url-crawler';

const html = await HttpHelper.fetchHtml('https://example.com');
const baseUrl = HttpHelper.getBaseUrl('https://example.com/page');
```

## Configuration

Configure the crawler behavior using environment variables:

- `MAX_DEPTH`: Maximum crawl depth (default: 3)
- `MAX_PAGES`: Maximum number of pages to crawl (default: 3)

```typescript
import { config } from 'url-crawler';

console.log(config.MAX_DEPTH);
console.log(config.MAX_PAGES);
```

## Events

The `Crawler` class emits the following events:

- **`crawl:started`**: Emitted when crawling begins. Payload: `{ url, timestamp }`
- **`page:processed`**: Emitted when a page is successfully crawled. Payload: `{ url, title, content }`
- **`page:error`**: Emitted when a page fails to crawl. Payload: `{ url, message }`
- **`crawl:completed`**: Emitted when crawling completes successfully. Payload: `{ url, totalPages, durationMs }`
- **`crawl:error`**: Emitted when a critical crawl error occurs. Payload: `{ url, message }`

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
│   ├── robustCrawler.ts  # Event-driven crawler implementation
│   ├── crawler.ts        # Basic crawler class
│   └── httpHelper.ts     # HTTP utilities (fetch, URL parsing)
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