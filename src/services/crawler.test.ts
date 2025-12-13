// src/services/crawler.test.ts
import { Crawler } from './crawler';
import { EventEmitter } from 'events';
import { RobotsTxt } from './robotsTxt';
import { HtmlParser } from '../utils/htmlParser';
import { HttpHelper } from './httpHelper';
import { config, EVENT_TYPES } from '../config/index';
import { ParsedContentDetails } from '../types/index';
import { HostRateLimiter } from '../utils/hostRateLimiter';

// Mock all dependencies

jest.mock('./robotsTxt');
jest.mock('../utils/htmlParser');
jest.mock('./httpHelper');
jest.mock('../config/index');
jest.mock('../types/index');
jest.mock('../utils/hostRateLimiter');
// Only mock dependencies, NOT the Crawler class itself
jest.mock('./robotsTxt');
jest.mock('../utils/htmlParser');
jest.mock('./httpHelper');
jest.mock('../config/index');
jest.mock('../types/index');
jest.mock('../utils/hostRateLimiter');

describe('Crawler', () => {
    let crawler: Crawler;
    let mockRateLimiter: jest.Mocked<HostRateLimiter>;
    let mockRobotsTxt: jest.Mocked<typeof RobotsTxt>;
    let mockHtmlParser: jest.Mocked<typeof HtmlParser>;
    let mockHttpHelper: jest.Mocked<typeof HttpHelper>;
    let mockConfig: jest.Mocked<typeof config>;
    let mockEventEmitter: jest.Mocked<EventEmitter>;

    const sourceUrl = 'https://example.com';
    const baseUrl = 'https://example.com';

    beforeEach(() => {
        mockRobotsTxt = RobotsTxt as jest.Mocked<typeof RobotsTxt>;
        mockHtmlParser = HtmlParser as jest.Mocked<typeof HtmlParser>;
        mockHttpHelper = HttpHelper as jest.Mocked<typeof HttpHelper>;
        mockConfig = config as jest.Mocked<typeof config>;

        // Reset mocks
        jest.clearAllMocks();

        // Mock HttpHelper
        mockHttpHelper.getBaseUrl.mockReturnValue(baseUrl);
        mockHttpHelper.fetchContent.mockResolvedValue('<html><body><h1>Title</h1><a href="/page1">Link</a></body></html>');

        // Mock RobotsTxt
        mockRobotsTxt.canCrawl.mockResolvedValue(true);

        // Mock HtmlParser
        const parsedContent: ParsedContentDetails = {
            title: 'Test Title',
            cleanedContent: 'Cleaned content',
            otherPageUrls: ['https://example.com/page1']
        };
        mockHtmlParser.extractRelevantContentFromHtml.mockReturnValue(parsedContent);

        // Mock HostRateLimiter
        mockRateLimiter = {
            schedule: jest.fn().mockResolvedValue('<html><body><h1>Title</h1><a href="/page1">Link</a></body></html>')
        } as any;

        // Mock config
        mockConfig.MAX_DEPTH = 2;
        mockConfig.MAX_PAGES = 10;
        (mockConfig as any).CRAWL_DELAY_MS = 100;

        // Create crawler instance
        crawler = new Crawler(sourceUrl);
        // Override rateLimiter with mock
        (crawler as any).rateLimiter = mockRateLimiter;
        // Spy on emit method
        jest.spyOn(crawler, 'emit');
    });

    describe('constructor', () => {
        it('should initialize with sourceUrl and default config', () => {
            expect(mockHttpHelper.getBaseUrl).toHaveBeenCalledWith(sourceUrl);
            expect((crawler as any).sourceUrl).toBe(sourceUrl);
            expect((crawler as any).baseUrl).toBe(baseUrl);
            expect((crawler as any).visitedUrls).toBeInstanceOf(Set);
            expect((crawler as any).rateLimiter).toBe(mockRateLimiter);
        });

        it('should apply configOverrides', () => {
            const overrides = { MAX_DEPTH: 5 };
            new Crawler(sourceUrl, overrides);
            expect(mockConfig.MAX_DEPTH).toBe(5);
        });
    });

    describe('startCrawl', () => {
        it('should emit CRAWL_STARTED, crawl, and emit CRAWL_COMPLETED on success', async () => {
            await crawler.startCrawl();

            // 1st: CRAWL_STARTED
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(1, EVENT_TYPES.CRAWL_STARTED, expect.objectContaining({ url: sourceUrl }));
            // 2nd: PAGE_PROCESSED (sourceUrl)
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(2, EVENT_TYPES.PAGE_PROCESSED, expect.objectContaining({ url: sourceUrl, title: 'Test Title' }));
            // 3rd: PAGE_PROCESSED (linked page)
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(3, EVENT_TYPES.PAGE_PROCESSED, expect.objectContaining({ url: 'https://example.com/page1', title: 'Test Title' }));
            // 4th: CRAWL_COMPLETED
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(4, EVENT_TYPES.CRAWL_COMPLETED, expect.objectContaining({ url: sourceUrl, totalPages: 2 }));
        });

        it('should emit CRAWL_ERROR on critical failure', async () => {
            mockRateLimiter.schedule.mockRejectedValue(new Error('Network error'));

            await crawler.startCrawl();

            // 1st: CRAWL_STARTED
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(1, EVENT_TYPES.CRAWL_STARTED, expect.objectContaining({ url: sourceUrl }));
            // 2nd: PAGE_ERROR (network error)
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(2, EVENT_TYPES.PAGE_ERROR, expect.objectContaining({ url: sourceUrl, message: 'Network error' }));
            // 3rd: CRAWL_COMPLETED (should still emit completed event)
            expect((crawler.emit as jest.Mock)).toHaveBeenNthCalledWith(3, EVENT_TYPES.CRAWL_COMPLETED, expect.objectContaining({ url: sourceUrl, totalPages: 1 }));
        });
    });

    describe('_crawl', () => {
        it('should stop if MAX_PAGES reached', async () => {
            (crawler as any).visitedUrls.add('dummy1');
            (crawler as any).visitedUrls.add('dummy2');
            mockConfig.MAX_PAGES = 2;

            await (crawler as any)._crawl('https://example.com/page2', 0);

            expect(mockRateLimiter.schedule).not.toHaveBeenCalled();
        });

        it('should stop if MAX_DEPTH reached', async () => {
            mockConfig.MAX_DEPTH = 0;

            await (crawler as any)._crawl(sourceUrl, 1);

            expect(mockRateLimiter.schedule).not.toHaveBeenCalled();
        });

        it('should skip if already visited', async () => {
            (crawler as any).visitedUrls.add(sourceUrl);

            await (crawler as any)._crawl(sourceUrl, 0);

            expect(mockRateLimiter.schedule).not.toHaveBeenCalled();
        });

        it('should skip and emit PAGE_ERROR if blocked by robots.txt', async () => {
            mockRobotsTxt.canCrawl.mockResolvedValue(false);

            await (crawler as any)._crawl(sourceUrl, 0);

            expect((crawler.emit as jest.Mock)).toHaveBeenCalledWith(EVENT_TYPES.PAGE_ERROR, { url: sourceUrl, message: 'Blocked by robots.txt' });
            expect(mockRateLimiter.schedule).not.toHaveBeenCalled();
        });

        it('should fetch, parse, emit PAGE_PROCESSED, and crawl further on success', async () => {
            await (crawler as any)._crawl(sourceUrl, 0);

            expect(mockRobotsTxt.canCrawl).toHaveBeenCalledWith(sourceUrl);
            expect(mockRateLimiter.schedule).toHaveBeenCalledWith(sourceUrl, expect.any(Function));
            expect(mockHtmlParser.extractRelevantContentFromHtml).toHaveBeenCalled();
            expect((crawler.emit as jest.Mock)).toHaveBeenCalledWith(EVENT_TYPES.PAGE_PROCESSED, expect.objectContaining({ url: sourceUrl, title: 'Test Title' }));
            // Should attempt to crawl the linked page
            expect(mockRobotsTxt.canCrawl).toHaveBeenCalledWith('https://example.com/page1');
        });

        it('should not crawl further if MAX_PAGES reached during recursion', async () => {
            mockConfig.MAX_PAGES = 1; // Only allow the initial page

            await (crawler as any)._crawl(sourceUrl, 0);

            expect(mockRateLimiter.schedule).toHaveBeenCalledTimes(1); // Only for sourceUrl
        });

        it('should emit PAGE_ERROR on fetch/parse error', async () => {
            mockRateLimiter.schedule.mockRejectedValue(new Error('Fetch error'));

            await (crawler as any)._crawl(sourceUrl, 0);

            expect((crawler.emit as jest.Mock)).toHaveBeenCalledWith(EVENT_TYPES.PAGE_ERROR, { url: sourceUrl, message: 'Fetch error' });
        });

        it('should handle multiple links and crawl recursively', async () => {
            const parsedContent: ParsedContentDetails = {
                title: 'Test Title',
                cleanedContent: 'Cleaned content',
                otherPageUrls: ['https://example.com/page1', 'https://example.com/page2']
            };
            mockHtmlParser.extractRelevantContentFromHtml.mockReturnValue(parsedContent);

            await (crawler as any)._crawl(sourceUrl, 0);

            expect(mockRateLimiter.schedule).toHaveBeenCalledTimes(3); // source + page1 + page2
        });
    });
});