# URL Crawler Library - Production Readiness Implementation Guide

This guide provides detailed prompts and implementation strategies to transform the URL Crawler library from a prototype into a production-grade application.

## Phase 1: Critical Fixes (MUST IMPLEMENT FIRST)

### 1.1 Fix Configuration Mutation Issue

**Problem**: Config object is mutated globally, causing multiple Crawler instances to interfere with each other.

**Current Behavior**:
```typescript
const crawler1 = new Crawler(url1, { MAX_DEPTH: 5 });  // Changes shared config
const crawler2 = new Crawler(url2, { MAX_DEPTH: 2 });  // crawler1 now also has MAX_DEPTH: 2
```

**Implementation Strategy**:
- Move config assignment from global `config` to instance property
- Create instance-level config object that merges defaults with overrides
- Update all references to `config` in Crawler to use `this.config`
- Ensure RobotsTxt cache remains global (shared across instances)

**Code Changes Required**:
1. Modify `src/services/crawler.ts`:
   - Add `private instanceConfig: Config` property
   - Initialize in constructor: `this.instanceConfig = { ...config, ...configOverrides }`
   - Replace all `config.MAX_DEPTH` with `this.instanceConfig.MAX_DEPTH`
   - Replace all `config.MAX_PAGES` with `this.instanceConfig.MAX_PAGES`
   - Pass instance config to HostRateLimiter

2. Modify `src/utils/hostRateLimiter.ts`:
   - Accept config as constructor parameter
   - Use instance config instead of global config

3. Update tests to verify instance isolation

**Test Cases**:
- Two concurrent crawlers with different MAX_DEPTH shouldn't interfere
- Each crawler maintains independent visitedUrls
- Config defaults still work when no overrides provided

---

### 1.2 Add Request Timeout

**Problem**: `fetch()` calls have no timeout, causing indefinite hangs on unresponsive servers.

**Recommended Timeout**: 30-60 seconds

**Implementation Strategy**:
1. Create AbortController for each request
2. Set timeout to abort request after configured duration
3. Make timeout configurable via environment variable

**Code Changes Required**:
1. Modify `src/config/index.ts`:
   - Add `REQUEST_TIMEOUT_MS` with default 30000 (30 seconds)
   - Add to Config type

2. Modify `src/services/httpHelper.ts`:
   - Import AbortController
   - Accept timeout as parameter
   - Create AbortController with timeout
   - Pass signal to fetch options

**Code Example**:
```typescript
static async fetchContent(url: string, timeoutMs: number = 30000): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; url-crawler/1.0)'
            }
        });
        // ... rest of implementation
    } finally {
        clearTimeout(timeoutId);
    }
}
```

**Test Cases**:
- Request completes normally within timeout
- Request aborts with timeout error after specified duration
- Error message clearly indicates timeout

---

### 1.3 Implement Request Retry Logic

**Problem**: Network failures fail immediately without recovery; transient errors cause page drops.

**Strategy**: Exponential backoff with jitter
- Retry attempts: 3 (total 4 attempts including initial)
- Base delay: 1000ms
- Max delay: 30000ms
- Jitter: Random 0-500ms added to prevent thundering herd

**Implementation Strategy**:
1. Create retry utility function
2. Wrap HttpHelper.fetchContent calls with retry logic
3. Make retry configuration customizable
4. Only retry on transient errors (network, 5xx, 429)

**Code Changes Required**:
1. Create `src/utils/retry.ts`:
```typescript
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    jitterMs: number;
    shouldRetry: (error: Error) => boolean;
}

export async function withRetry<T>(
    action: () => Promise<T>,
    config: RetryConfig,
    onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void
): Promise<T> {
    // Implementation with exponential backoff
}
```

2. Modify `src/services/httpHelper.ts`:
   - Add retry config to HttpHelper
   - Wrap fetchContent with withRetry
   - Define which errors are retryable

3. Modify `src/config/index.ts`:
   - Add RETRY_CONFIG with defaults

**Retryable Errors**:
- Network errors (ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET)
- HTTP 429 (Too Many Requests)
- HTTP 503 (Service Unavailable)
- HTTP 502 (Bad Gateway)
- Timeout errors

**Non-Retryable Errors**:
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 404 (Not Found)
- Protocol errors

**Test Cases**:
- Succeeds on first attempt (no retry)
- Retries on network error, succeeds on 2nd attempt
- Fails after max retries exceeded
- Applies exponential backoff correctly
- Doesn't retry non-retryable errors
- Jitter prevents thundering herd

---

### 1.4 Add Structured Logging

**Problem**: All output uses `console.log()` - no log levels, no way to suppress or customize.

**Strategy**: Implement structured logging with levels (ERROR, WARN, INFO, DEBUG)

**Implementation Strategy**:
1. Create simple logger utility or integrate Winston
2. Add log level config
3. Replace all console.log with appropriate logger calls
4. Format logs consistently (timestamp, level, component, message)

**Code Changes Required**:
1. Create `src/utils/logger.ts`:
```typescript
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

export class Logger {
    constructor(private component: string, private level: LogLevel = LogLevel.INFO) {}
    
    error(message: string, context?: any): void { }
    warn(message: string, context?: any): void { }
    info(message: string, context?: any): void { }
    debug(message: string, context?: any): void { }
}
```

2. Add to config:
   - LOG_LEVEL environment variable (default: INFO)

3. Replace all console.log in:
   - `src/services/crawler.ts`
   - `src/utils/hostRateLimiter.ts`
   - `src/services/robotsTxt.ts` (if needed)

**Log Format**:
```
[2024-12-13T10:30:45.123Z] [INFO] [Crawler] Starting crawl for https://example.com
[2024-12-13T10:30:45.500Z] [DEBUG] [HttpHelper] Fetching https://example.com (attempt 1/4)
[2024-12-13T10:30:46.000Z] [ERROR] [HttpHelper] Timeout after 30000ms on https://example.com, retrying...
[2024-12-13T10:30:48.000Z] [INFO] [Crawler] Page processed: https://example.com (2 links found)
```

**Test Cases**:
- Messages logged at appropriate levels
- Log level filtering works correctly
- Sensitive data not leaked in logs

---

### 1.5 Add Specific HTTP Status Code Handling

**Problem**: All HTTP errors treated the same; no distinction between temporary (429, 503) and permanent errors.

**Implementation Strategy**:
1. Parse HTTP status codes
2. Categorize by retry-ability
3. Emit specific events for different error types
4. Add metrics for each category

**Code Changes Required**:
1. Modify `src/services/httpHelper.ts`:
   - Parse response status
   - Categorize errors
   - Throw error with status code and category

2. Modify `src/services/crawler.ts`:
   - Handle different error categories differently
   - Add specific logging for each category
   - Consider per-host backoff for persistent failures

3. Add to types:
```typescript
export type HttpErrorCategory = 
    | 'client-error' // 4xx (except retryable)
    | 'server-error' // 5xx
    | 'rate-limit'   // 429
    | 'network-error'
    | 'timeout';
```

**Specific Handling**:
- 429: Use longer backoff, respect Retry-After header
- 503: Use shorter backoff
- 404: Don't retry, emit page:error event
- 403: Don't retry, emit page:error event
- 401: Don't retry, emit page:error event

**Test Cases**:
- Different status codes categorized correctly
- 429 responses trigger longer backoff
- 404/403/401 don't trigger retries
- Retry-After header respected for 429/503

---

## Phase 2: Should-Have Enhancements (IMPLEMENT AFTER PHASE 1)

### 2.1 Add Graceful Shutdown

**Problem**: No way to stop an ongoing crawl or clean up pending requests.

**Implementation Strategy**:
1. Add abort signal to Crawler
2. Check signal in _crawl method
3. Clean up pending promises
4. Provide shutdown method

**Code Changes Required**:
1. Modify `src/services/crawler.ts`:
   - Add `private abortController: AbortController` property
   - Create `shutdown()` method that calls `abortController.abort()`
   - Check signal in `_crawl()` before each operation
   - Propagate signal to async operations

**API**:
```typescript
const crawler = new Crawler(url);
crawler.on('page:processed', (data) => {
    if (someCondition) {
        crawler.shutdown(); // Stop gracefully
    }
});
await crawler.startCrawl(); // Will stop early when signal aborted
```

**Test Cases**:
- Shutdown stops new page crawls
- Pending requests don't cause errors after shutdown
- Events still emitted for visited pages

---

### 2.2 Implement Memory Management for Large Crawls

**Problem**: `visitedUrls` Set grows indefinitely, causing memory issues for large crawls.

**Implementation Strategy**:
1. Use LRU cache with configurable size limit
2. Option to use external storage (Redis/Database) for very large crawls
3. Add metrics for memory usage

**Code Changes Required**:
1. Create `src/utils/lruCache.ts`:
```typescript
export class LRUCache<K, V> {
    private cache: Map<K, V>;
    private maxSize: number;
    
    constructor(maxSize: number) { }
    has(key: K): boolean { }
    set(key: K, value: V): void { }
    get(key: K): V | undefined { }
}
```

2. Modify `src/services/crawler.ts`:
   - Replace Set with LRUCache
   - Add MAX_VISITED_URLS_MEMORY config
   - Handle cache evictions

**Configuration**:
- MAX_VISITED_URLS_MEMORY: 10000 (default, ~500KB-1MB)
- VISITED_URL_STORAGE: 'memory' | 'redis' | 'database'

**Test Cases**:
- Cache respects size limit
- LRU eviction works correctly
- URLs still tracked as visited during crawl
- Memory usage stays bounded

---

### 2.3 Add Configurable Per-Host Concurrency

**Problem**: Per-host concurrency is hardcoded to 1, limiting throughput. Need configurable concurrency with backpressure.

**Implementation Strategy**:
1. Make concurrency configurable
2. Add global concurrency limit to prevent resource exhaustion
3. Implement backpressure mechanism

**Code Changes Required**:
1. Modify `src/config/index.ts`:
   - Add MAX_CONCURRENT_PER_HOST (default: 1)
   - Add MAX_TOTAL_CONCURRENT (default: 10)

2. Modify `src/utils/hostRateLimiter.ts`:
   - Accept concurrency settings
   - Create Bottleneck.Group with per-host limiters
   - Add global limiter for total concurrency

**Configuration**:
```typescript
const crawler = new Crawler(url, {
    MAX_CONCURRENT_PER_HOST: 2,      // 2 requests per host
    MAX_TOTAL_CONCURRENT: 10          // 10 total requests across all hosts
});
```

**Test Cases**:
- Per-host concurrency limit respected
- Global concurrency limit respected
- Request ordering preserved per host
- Backpressure prevents resource exhaustion

---

### 2.4 Add Metrics Collection

**Problem**: No visibility into crawl performance, errors, or success rates.

**Implementation Strategy**:
1. Create metrics collector
2. Track key metrics (requests, errors, latency, cache hits)
3. Expose metrics endpoint or logging

**Metrics to Track**:
- Total requests: count
- Successful requests: count
- Failed requests: count (with breakdown by error type)
- Average latency: ms
- P95/P99 latency: ms
- Cache hit rate: percentage
- Robots.txt cache hit rate: percentage
- Pages processed: count
- Pages skipped (visited/blocked): count
- Depth distribution: histogram

**Code Changes Required**:
1. Create `src/utils/metrics.ts`:
```typescript
export class CrawlerMetrics {
    recordRequest(success: boolean, durationMs: number, statusCode?: number): void { }
    recordPageProcessed(): void { }
    getMetrics(): CrawlerMetricsSnapshot { }
}
```

2. Modify `src/services/crawler.ts`:
   - Create metrics instance
   - Record each operation
   - Emit metrics:complete event

**API**:
```typescript
crawler.on('crawl:completed', (data) => {
    const metrics = crawler.getMetrics();
    console.log(`Processed ${metrics.pagesProcessed} in ${metrics.durationMs}ms`);
    console.log(`Error rate: ${metrics.errorRate.toFixed(2)}%`);
    console.log(`Average latency: ${metrics.avgLatencyMs.toFixed(0)}ms`);
});
```

**Test Cases**:
- Metrics correctly counted
- Average latency calculated correctly
- Error rate calculation accurate
- Metrics reset between crawls

---

### 2.5 Add Request Tracing/Correlation IDs

**Problem**: No way to trace individual requests through logs for debugging.

**Implementation Strategy**:
1. Generate correlation ID per crawl session
2. Generate trace ID per request
3. Include in all logs and error messages

**Code Changes Required**:
1. Modify `src/services/crawler.ts`:
   - Add `correlationId` generated in constructor
   - Pass to logger and child components

2. Modify `src/utils/logger.ts`:
   - Accept correlationId and traceId
   - Include in log output

**Log Format with Tracing**:
```
[2024-12-13T10:30:45.123Z] [INFO] [Crawler] [corr-abc123] Starting crawl for https://example.com
[2024-12-13T10:30:45.500Z] [DEBUG] [HttpHelper] [corr-abc123][trace-xyz789] Fetching https://example.com (attempt 1/4)
[2024-12-13T10:30:46.000Z] [ERROR] [HttpHelper] [corr-abc123][trace-xyz789] Timeout after 30000ms
```

**Test Cases**:
- Correlation ID consistent across crawl
- Trace ID unique per request
- Trace ID in error messages
- Multiple crawls have different correlation IDs

---

### 2.6 Add Resumable Crawls (Persistence)

**Problem**: Can't resume crawls if process crashes; have to restart from beginning.

**Implementation Strategy**:
1. Persist crawl state to storage
2. Restore state on restart
3. Support multiple storage backends

**Code Changes Required**:
1. Create `src/services/crawlStateStore.ts`:
```typescript
export interface CrawlStateStore {
    saveState(crawlId: string, state: CrawlState): Promise<void>;
    loadState(crawlId: string): Promise<CrawlState | null>;
    deleteState(crawlId: string): Promise<void>;
}

export type CrawlState = {
    sourceUrl: string;
    visitedUrls: string[];
    failedUrls: Map<string, string>;
    config: Config;
    timestamp: number;
};
```

2. Modify `src/services/crawler.ts`:
   - Add crawlId (UUID)
   - Save state periodically (every 100 pages or 1 minute)
   - Load state on initialization if crawlId provided

**Storage Options**:
- File system (JSON)
- SQLite
- PostgreSQL
- Redis

**API**:
```typescript
// New crawl
const crawler = new Crawler(url);
await crawler.startCrawl();

// Resume crawl
const crawler = new Crawler(url, { crawlId: 'existing-id' });
await crawler.startCrawl(); // Resumes from where it left off
```

**Test Cases**:
- State saved correctly
- State loaded correctly
- Resuming continues from saved point
- Failed URLs tracked separately
- State deleted after successful completion

---

### 2.7 Add Database Integration for Visited URLs

**Problem**: For multi-process/distributed crawling, need shared visited URL tracking.

**Implementation Strategy**:
1. Support Redis or PostgreSQL for visited URL store
2. Use atomic operations to prevent duplicates in distributed scenario
3. Add distributed locking for coordination

**Code Changes Required**:
1. Create `src/services/visitedUrlStore.ts`:
```typescript
export interface VisitedUrlStore {
    has(url: string): Promise<boolean>;
    add(url: string): Promise<boolean>; // Returns true if added, false if already existed
    addBatch(urls: string[]): Promise<number>; // Returns count added
}
```

2. Modify `src/services/crawler.ts`:
   - Inject VisitedUrlStore dependency
   - Use async has/add operations

**Configuration**:
```typescript
const crawler = new Crawler(url, {
    visitedUrlStore: new RedisVisitedUrlStore({ host: 'localhost', port: 6379 }),
    // or
    visitedUrlStore: new PostgresVisitedUrlStore({ url: 'postgres://...' })
});
```

**Test Cases**:
- Redis store persists URLs
- Distributed instances see same visited URLs
- No duplicates in distributed crawl
- Atomic operations prevent race conditions

---

## Phase 3: Nice-to-Have Features (OPTIONAL)

### 3.1 Add Proxy Support
- Configure proxy per-crawler
- Support socks5, http, https proxies
- Add rotation capability

### 3.2 Add Custom Headers/Authentication
- Accept custom headers config
- Support basic auth, bearer tokens
- Support cookie handling

### 3.3 Add Sitemap.xml Detection
- Automatically detect sitemap.xml
- Prefer sitemap URLs over crawled links
- Parallel discovery with crawl

### 3.4 Add Crawl Analytics
- Depth distribution histogram
- Link distribution (internal vs external)
- Content type distribution
- Domain popularity stats

### 3.5 Add Middleware/Plugin System
- Pre-fetch middleware (modify request)
- Post-fetch middleware (modify response)
- Custom link filter
- Custom URL normalizer

---

## Implementation Priority & Timeline Estimate

**Week 1 (Critical - MUST DO)**:
- [ ] Fix config mutation (4 hours)
- [ ] Add request timeout (3 hours)
- [ ] Implement retry logic (6 hours)
- [ ] Add structured logging (5 hours)
- [ ] Add HTTP status handling (3 hours)
- **Total: ~21 hours**

**Week 2 (Should-Have - STRONGLY RECOMMENDED)**:
- [ ] Add graceful shutdown (3 hours)
- [ ] Memory management for large crawls (5 hours)
- [ ] Configurable concurrency (4 hours)
- [ ] Add metrics collection (6 hours)
- [ ] Add request tracing (3 hours)
- **Total: ~21 hours**

**Week 3 (Optional)**:
- [ ] Resumable crawls (8 hours)
- [ ] Database integration (8 hours)
- [ ] Proxy support (6 hours)
- [ ] Custom headers/auth (4 hours)
- **Total: ~26 hours**

---

## Testing Strategy

### Unit Tests to Add
- Each retry scenario
- Config isolation between instances
- Timeout triggering
- Error categorization
- Logger output format
- Metrics calculations
- Tracing ID generation
- State serialization

### Integration Tests to Add
- Multi-instance crawls without interference
- Graceful shutdown doesn't lose data
- Memory usage stays bounded on large crawls
- Distributed crawl with shared URL store

### Load Tests to Add
- 10K page crawl memory usage
- Throughput with different concurrency settings
- Latency under concurrent load

---

## Production Deployment Checklist

- [ ] All Phase 1 changes implemented and tested
- [ ] Phase 2 changes implemented (at least most)
- [ ] Code coverage >80%
- [ ] All tests pass (unit, integration, load)
- [ ] Documentation updated
- [ ] Error handling and retry logic tested in staging
- [ ] Logging validated in staging
- [ ] Performance benchmarked
- [ ] Security review completed (no log injection, etc.)
- [ ] Monitoring/alerting configured
- [ ] Rollback plan documented

---

## Example Production Configuration

```typescript
const crawler = new Crawler('https://example.com', {
    // Phase 1: Critical
    MAX_DEPTH: 3,
    MAX_PAGES: 1000,
    REQUEST_TIMEOUT_MS: 30000,
    LOG_LEVEL: 'INFO',
    
    // Phase 2: Enhanced
    MAX_CONCURRENT_PER_HOST: 2,
    MAX_TOTAL_CONCURRENT: 10,
    MAX_VISITED_URLS_MEMORY: 50000,
    CRAWL_DELAY_MS: 1000,
    
    // Phase 3: Optional
    proxy: 'socks5://proxy.company.com:1080',
    visitedUrlStore: new RedisVisitedUrlStore({ url: 'redis://...' }),
    stateStore: new PostgresStateStore({ url: 'postgres://...' }),
});

crawler.on('page:processed', (data) => {
    console.log(`✓ ${data.url}`);
});

crawler.on('page:error', (data) => {
    console.error(`✗ ${data.url}: ${data.message}`);
});

crawler.on('crawl:completed', (data) => {
    const metrics = crawler.getMetrics();
    console.log(`Crawl completed: ${metrics.pagesProcessed} pages in ${metrics.durationMs}ms`);
    console.log(`Success rate: ${((metrics.successCount / metrics.totalRequests) * 100).toFixed(2)}%`);
});

await crawler.startCrawl();
```

