import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { ParsedContentDetails } from '../types';

export class HtmlParser {
    static cleanHtml(html: string): string {
        return sanitizeHtml(html, {
            allowedTags: [],
            allowedAttributes: {},
            disallowedTagsMode: 'discard',
            nonTextTags: ['script', 'style', 'iframe', 'noscript']
        }).replace(/\s+/g, ' ').trim();
    }

    static extractAnchorTagUrlsFromHtml(html: string, baseUrl: string = ''): string[] {
        const $ = cheerio.load(html);
        const urls: string[] = [];
        $('a[href]').each((_, el) => {
            let href = $(el).attr('href');
            if (!href) return;
            // Ignore mailto, javascript, fragments
            if (/^(mailto:|javascript:|#)/i.test(href)) return;
            try {
                // Normalize using URL constructor
                const normalized = new URL(href, baseUrl).toString();
                urls.push(normalized);
            } catch {
                // Ignore invalid URLs
            }
        });
        return urls;
    }

    static extractRelevantContentFromHtml(html: string, baseUrl: string = ''): ParsedContentDetails {
        const $ = cheerio.load(html);
        const rawBodyContent = $('body').html() || '';
        const cleanedContent = this.cleanHtml(rawBodyContent);
        const pageTitle = $('title').text();
        const otherPageUrls = this.extractAnchorTagUrlsFromHtml(rawBodyContent, baseUrl);
        return {
            title: pageTitle,
            cleanedContent,
            otherPageUrls
        };
    }
}