
import Bottleneck from 'bottleneck';
import { config } from '../config';
import { RobotsTxt } from '../services/robotsTxt';
import { Config } from '../types';

export class HostRateLimiter {
    private group: Bottleneck.Group;

    constructor() {
        this.group = new Bottleneck.Group({
            maxConcurrent: 1
        });
    }

    async schedule<T>(url: string, action: () => Promise<T>): Promise<T> {
        const host = new URL(url).host;
        const limiter = this.group.key(host);

        const robotsDelaySec = RobotsTxt.getCrawlDelay(url) || 0;
        const minTime = robotsDelaySec > 0 ? robotsDelaySec * 1000 : ((config as Config).CRAWL_DELAY_MS ?? 1000);

        // Ensure the limiter uses the desired minTime for this host.
        // updateSettings is safe to call repeatedly.
        try {
            await limiter.updateSettings({ minTime });
        } catch (err) {
            // ignore update errors and proceed — schedule will still work with previous settings
        }

        return limiter.schedule(() => action());
    }
};
