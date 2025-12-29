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
                  return { store: cachedStore, ttl: 10 };
            }

            cachedStore = await redisStore({
                  host: configService.get<string>('REDIS_HOST') || 'localhost',
                  port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
                  password: configService.get<string>('REDIS_PASSWORD') || undefined,
                  // db: parseInt(configService.get<string>('REDIS_DB') || '0', 10),
                  ttl: 10, // Default TTL: 10 seconds
                  maxRetriesPerRequest: 3,
                  lazyConnect: true,
                  enableReadyCheck: true,
            });

            return { store: cachedStore, ttl: 10 };
      },
      inject: [ConfigService],
};
