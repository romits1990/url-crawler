import axios from 'axios';

export class HttpHelper {
    static async fetchHtml(url: string): Promise<string> {
        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error: any) {
            throw new Error(`Failed to fetch HTML from ${url}: ${error.message}`);
        }
    }

    static getBaseUrl(url: string): string {
        const parsedUrl = new URL(url);
        return `${parsedUrl.protocol}//${parsedUrl.hostname}`;
    }
}
    