// src/services/robotsTxt.test.ts
import { RobotsTxt } from './robotsTxt';

// Mock fetch
global.fetch = jest.fn();

describe('RobotsTxt', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear robots.txt cache for test isolation
        (RobotsTxt as any).robotsCache?.clear?.();
    });

    describe('canCrawl', () => {
        it('should return true if robots.txt allows crawling', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('User-agent: *\nAllow: /')
            });

            const result = await RobotsTxt.canCrawl('https://example.com/page');
            expect(result).toBe(true);
        });

        it('should return false if robots.txt disallows crawling', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('User-agent: *\nDisallow: /')
            });

            const result = await RobotsTxt.canCrawl('https://example.com/page');
            expect(result).toBe(false);
        });

        it('should return true if no robots.txt found', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false
            });

            const result = await RobotsTxt.canCrawl('https://example.com/page');
            expect(result).toBe(true);
        });

        it('should handle fetch errors gracefully', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            const result = await RobotsTxt.canCrawl('https://example.com/page');
            expect(result).toBe(true); // Default to allow on error
        });

        it('should cache robots.txt content', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('User-agent: *\nAllow: /')
            });

            await RobotsTxt.canCrawl('https://example.com/page1');
            await RobotsTxt.canCrawl('https://example.com/page2');

            expect(global.fetch).toHaveBeenCalledTimes(1);
        });
    });
});