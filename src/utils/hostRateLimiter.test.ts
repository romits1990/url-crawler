// src/utils/hostRateLimiter.test.ts
import { HostRateLimiter } from './hostRateLimiter';

describe('HostRateLimiter', () => {
    let rateLimiter: HostRateLimiter;

    beforeEach(() => {
        jest.clearAllMocks();
        rateLimiter = new HostRateLimiter();
    });

    describe('schedule', () => {
        it('should execute the task immediately if no delay', async () => {
            const task = jest.fn().mockResolvedValue('result');

            const result = await rateLimiter.schedule('https://example.com', task);

            expect(task).toHaveBeenCalled();
            expect(result).toBe('result');
        });

        it('should delay subsequent requests to the same host', async () => {
            const task1 = jest.fn().mockResolvedValue('result1');
            const task2 = jest.fn().mockResolvedValue('result2');

            const promise1 = rateLimiter.schedule('https://example.com/page1', task1);
            const promise2 = rateLimiter.schedule('https://example.com/page2', task2);

            await Promise.all([promise1, promise2]);

            expect(task1).toHaveBeenCalled();
            expect(task2).toHaveBeenCalled();
        }, 10000);

        it('should not delay requests to different hosts', async () => {
            const task1 = jest.fn().mockResolvedValue('result1');
            const task2 = jest.fn().mockResolvedValue('result2');

            await Promise.all([
                rateLimiter.schedule('https://example.com', task1),
                rateLimiter.schedule('https://other.com', task2)
            ]);

            expect(task1).toHaveBeenCalled();
            expect(task2).toHaveBeenCalled();
        }, 10000);

        it('should handle task errors', async () => {
            const task = jest.fn().mockRejectedValue(new Error('Task error'));

            await expect(rateLimiter.schedule('https://example.com', task)).rejects.toThrow('Task error');
        }, 10000);
    });
});