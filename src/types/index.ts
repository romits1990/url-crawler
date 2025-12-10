export type ParsedContentDetails = {
    title: string;
    cleanedContent: string;
    otherPageUrls: string[];
};

export type CrawlStartedEventPayload = { url: string; timestamp: number };
export type CrawlCompletedEventPayload = { url: string; totalPages: number; durationMs: number };
export type CrawlErrorEventPayload = { url: string; message: string };
export type PageProcessedEventPayload = { url: string; title: string; content: string };
export type PageErrorEventPayload = { url: string; message: string };
export type EventData = CrawlStartedEventPayload | CrawlCompletedEventPayload | CrawlErrorEventPayload | PageProcessedEventPayload | PageErrorEventPayload;