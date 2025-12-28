import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

export const RedisCacheOptions: CacheModuleAsyncOptions = {
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
            store: await redisStore({
                  host: configService.get<string>('REDIS_HOST') || 'localhost',
                  port: parseInt(configService.get<string>('REDIS_PORT') || '6379', 10),
                  password: configService.get<string>('REDIS_PASSWORD') || undefined,
                  // db: parseInt(configService.get<string>('REDIS_DB') || '0', 10),
                  ttl: 60 * 60, // Default TTL: 1 hour in seconds
            }),
      }),
      inject: [ConfigService],
};
