// src/utils/htmlParser.test.ts
import { HtmlParser } from './htmlParser';
import { ParsedContentDetails } from '../types/index';

describe('HtmlParser', () => {
    describe('extractRelevantContentFromHtml', () => {
        it('should extract title, cleaned content, and links from HTML', () => {
            const html = `
                <html>
                    <head><title>Test Page</title></head>
                    <body>
                        <h1>Main Heading</h1>
                        <p>This is some content.</p>
                        <a href="/page1">Link 1</a>
                        <a href="https://external.com">External Link</a>
                        <script>alert('ignore');</script>
                    </body>
                </html>
            `;
            const baseUrl = 'https://example.com';

            const result: ParsedContentDetails = HtmlParser.extractRelevantContentFromHtml(html, baseUrl);

            expect(result.title).toBe('Test Page');
            expect(result.cleanedContent).toContain('Main Heading');
            expect(result.cleanedContent).toContain('This is some content.');
            expect(result.otherPageUrls).toEqual(['https://example.com/page1']);
        });

        it('should handle missing title', () => {
            const html = '<html><body><p>Content</p></body></html>';
            const result = HtmlParser.extractRelevantContentFromHtml(html, 'https://example.com');

            expect(result.title).toBe('');
        });

        it('should filter out external links', () => {
            const html = '<a href="https://other.com">External</a><a href="/internal">Internal</a>';
            const result = HtmlParser.extractRelevantContentFromHtml(html, 'https://example.com');

            expect(result.otherPageUrls).toEqual(['https://example.com/internal']);
        });

        it('should clean HTML by removing scripts and styles', () => {
            const html = '<p>Text</p><script>code</script><style>css</style>';
            const result = HtmlParser.extractRelevantContentFromHtml(html, 'https://example.com');

            expect(result.cleanedContent).not.toContain('script');
            expect(result.cleanedContent).not.toContain('style');
        });

        it('should handle empty HTML', () => {
            const result = HtmlParser.extractRelevantContentFromHtml('', 'https://example.com');

            expect(result.title).toBe('');
            expect(result.cleanedContent).toBe('');
            expect(result.otherPageUrls).toEqual([]);
        });

        it('should resolve relative URLs correctly', () => {
            const html = '<a href="page.html">Relative</a><a href="../parent">Parent</a>';
            const result = HtmlParser.extractRelevantContentFromHtml(html, 'https://example.com/sub/');

            expect(result.otherPageUrls).toContain('https://example.com/sub/page.html');
            expect(result.otherPageUrls).toContain('https://example.com/parent');
        });
    });
});