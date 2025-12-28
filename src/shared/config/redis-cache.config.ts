import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

// Cache the store instance to reuse connections in serverless
let cachedStore: Awaited<ReturnType<typeof redisStore>> | null = null;

export const RedisCacheOptions: CacheModuleAsyncOptions = {
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
            // Reuse cached store in serverless environments
            if (cachedStore) {
                  return { store: cachedStore, ttl: 60 * 60 };
            }

            cachedStore = await redisStore({
                  host: configService.get<string>('REDIS_HOST') || 'localhost',
                  port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
                  password: configService.get<string>('REDIS_PASSWORD') || undefined,
                  // db: parseInt(configService.get<string>('REDIS_DB') || '0', 10),
                  ttl: 60 * 60, // Default TTL: 1 hour in seconds
                  maxRetriesPerRequest: 3,
                  lazyConnect: true,
                  enableReadyCheck: true,
            });

            return { store: cachedStore, ttl: 60 * 60 };
      },
      inject: [ConfigService],
};
