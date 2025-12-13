import robotsParser, { Robot  } from 'robots-parser';
import { HttpHelper } from './httpHelper.js';
import { CRAWLER_USER_AGENT, ROBOTS_CACHE_TTL_MS } from '../config/index.js';
import { RobotsTxtCacheEntry } from '../types/index.js';

export class RobotsTxt {
  private static robotsCache = new Map<string, RobotsTxtCacheEntry>();

  static async canCrawl(url: string, robotsCacheTTLConfigOverride?: number): Promise<boolean> {
    const robotsUrl = HttpHelper.getRobotsUrl(url);
    const now = Date.now();
    let robot: Robot | undefined;

    const entry: RobotsTxtCacheEntry | undefined = this.robotsCache.get(robotsUrl);
    if (entry) {
      if (entry.expiresAt > now) {
        robot = entry.robot;
      } else {
        // expired
        this.robotsCache.delete(robotsUrl);
      }
    }

    if (!robot) {
      try {
        const robotsTxt = await HttpHelper.fetchContent(robotsUrl);
        robot = robotsParser(robotsUrl, robotsTxt);
        const robotsCacheTTL = robotsCacheTTLConfigOverride ?? ROBOTS_CACHE_TTL_MS;
        this.robotsCache.set(robotsUrl, { robot, expiresAt: now + robotsCacheTTL });
      } catch (error) {
        // If we fail to fetch or parse the robots.txt, we assume we can crawl.
        return true;
      }
    }

    return robot.isAllowed(url, CRAWLER_USER_AGENT) === true;
  }

  static getCrawlDelay(url: string): number {
    const robotsUrl = HttpHelper.getRobotsUrl(url);
    const entry: RobotsTxtCacheEntry | undefined= this.robotsCache.get(robotsUrl);
    return entry ? (entry.robot.getCrawlDelay(CRAWLER_USER_AGENT) || 0) : 0;
  }
}


