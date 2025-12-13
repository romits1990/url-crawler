

export class HttpHelper {
    static async fetchContent(url: string): Promise<string> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; url-crawler/1.0)'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.text();
        } catch (error: any) {
            throw new Error(error.message || 'Network error');
        }
    }

    static getBaseUrl(url: string): string {
        const parsedUrl = new URL(url);
        let base = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        if (parsedUrl.port) {
            base += `:${parsedUrl.port}`;
        }
        return base;
    }

    static getRobotsUrl(url: string): string {
        const parsedUrl = new URL(url);
        return `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    }
}
    