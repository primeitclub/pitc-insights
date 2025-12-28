//  NOTE : ioredis is better than node-redis or redis as it supports better features and is more robust for production use cases lso dont have to install types separately
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

// Singleton Redis instance for serverless environments to prevent connection exhaustion
let sharedRedisClient: Redis | null = null;

@Injectable()
export class ConnectRedis implements OnModuleDestroy {
      private redisClient: Redis;

      constructor() {
            // Reuse existing connection in serverless environments
            if (sharedRedisClient && sharedRedisClient.status === 'ready') {
                  this.redisClient = sharedRedisClient;
                  return;
            }

            this.redisClient = new Redis({
                  host: process.env.REDIS_HOST || 'localhost',
                  port: parseInt(process.env.REDIS_PORT || '6379'),
                  username: process.env.REDIS_USERNAME || undefined,
                  password: process.env.REDIS_PASSWORD || undefined,
                  maxRetriesPerRequest: 3,
                  lazyConnect: true,
                  enableReadyCheck: true,
                  // Disconnect idle clients faster in serverless
                  disconnectTimeout: 2000,
            });

            sharedRedisClient = this.redisClient;

            this.redisClient.on('connect', () => {
                  console.log('✅ Redis connected successfully');
            });

            this.redisClient.on('error', (error: Error) => {
                  console.error('❌ Redis connection error:', error.message);
            });
      }

      getClient(): Redis {
            return this.redisClient;
      }

      // Cache helpers
      async get<T>(key: string): Promise<T | null> {
            const data = await this.redisClient.get(key);
            return data ? JSON.parse(data) : null;
      }

      async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<void> {
            await this.redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      }

      async del(key: string): Promise<void> {
            await this.redisClient.del(key);
      }

      async exists(key: string): Promise<boolean> {
            return (await this.redisClient.exists(key)) === 1;
      }

      // Cleanup on module destroy
      async onModuleDestroy(): Promise<void> {
            await this.redisClient.quit();
            console.log('Redis connection closed');
      }
}