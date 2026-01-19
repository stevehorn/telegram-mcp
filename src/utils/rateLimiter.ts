/**
 * Rate limiting and circuit breaker utilities for Telegram API
 */

import { RateLimiter } from 'limiter';
import pLimit from 'p-limit';
import CircuitBreaker from 'opossum';
import type { TelegramClient } from 'telegram';

export class TelegramRateLimiter {
  private globalLimiter = new RateLimiter({
    tokensPerInterval: 30,
    interval: 'second',
    fireImmediately: true
  });

  private chatLimiters = new Map<string, RateLimiter>();
  private concurrencyLimiter: (fn: () => Promise<any>) => Promise<any>;

  constructor(maxConcurrency: number = 20) {
    this.concurrencyLimiter = pLimit(maxConcurrency);
  }

  async execute<T>(
    chatId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    // Global rate limit
    await this.globalLimiter.removeTokens(1);

    // Chat-specific rate limit
    const chatLimiter = this.getChatLimiter(chatId);
    await chatLimiter.removeTokens(1);

    // Concurrency limit
    return this.concurrencyLimiter(operation);
  }

  private getChatLimiter(chatId: string): RateLimiter {
    if (!this.chatLimiters.has(chatId)) {
      this.chatLimiters.set(chatId, new RateLimiter({
        tokensPerInterval: 1,
        interval: 'second',
        fireImmediately: true
      }));
    }
    return this.chatLimiters.get(chatId)!;
  }
}

export class TelegramCircuitBreaker {
  private state: 'closed' | 'open' | 'half_open' = 'closed';
  private failures = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private failureThreshold = 5,
    private resetTimeout = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'half_open';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.resetTimeout;

      console.error('Circuit breaker opened for Telegram API', {
        failures: this.failures,
        threshold: this.failureThreshold,
        resetIn: this.resetTimeout
      });
    }
  }

  getState(): string {
    return this.state;
  }

  // Reset circuit manually if needed
  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.nextAttemptTime = 0;
  }
}

// Global instances for reuse
export const globalRateLimiter = new TelegramRateLimiter();
export const globalCircuitBreaker = new TelegramCircuitBreaker();