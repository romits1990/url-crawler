// src/services/httpHelper.test.ts
import { HttpHelper } from './httpHelper';

// Mock fetch
global.fetch = jest.fn();

describe('HttpHelper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getBaseUrl', () => {
        it('should return the base URL from a full URL', () => {
            const url = 'https://example.com/path/page.html?query=1';
            const result = HttpHelper.getBaseUrl(url);

            expect(result).toBe('https://example.com');
        });

        it('should handle URLs without path', () => {
            const url = 'https://example.com';
            const result = HttpHelper.getBaseUrl(url);

            expect(result).toBe('https://example.com');
        });

        it('should handle URLs with ports', () => {
            const url = 'https://example.com:8080/path';
            const result = HttpHelper.getBaseUrl(url);

            expect(result).toBe('https://example.com:8080');
        });
    });

    describe('fetchContent', () => {
        it('should fetch and return HTML content on success', async () => {
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue('<html>Content</html>')
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            const result = await HttpHelper.fetchContent('https://example.com');

            expect(result).toBe('<html>Content</html>');
            expect(global.fetch).toHaveBeenCalledWith('https://example.com', expect.any(Object));
        });

        it('should throw error on non-ok response', async () => {
            const mockResponse = {
                ok: false,
                status: 404
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            await expect(HttpHelper.fetchContent('https://example.com')).rejects.toThrow('HTTP 404');
        });

        it('should throw error on fetch failure', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(HttpHelper.fetchContent('https://example.com')).rejects.toThrow('Network error');
        });

        it('should include user agent in headers', async () => {
            const mockResponse = {
                ok: true,
                text: jest.fn().mockResolvedValue('')
            };
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

            await HttpHelper.fetchContent('https://example.com');

            expect(global.fetch).toHaveBeenCalledWith('https://example.com', expect.objectContaining({
                headers: expect.objectContaining({
                    'User-Agent': expect.any(String)
                })
            }));
        });
    });
});