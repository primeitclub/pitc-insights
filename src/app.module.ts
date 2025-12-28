import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { InsightsModule } from './modules/insights/insights.module';
import { RedisCacheOptions } from './shared/config/redis-cache.config';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600000, // 1 hour
          limit: 100,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // NOTE: for register and cache with Redis
    CacheModule.registerAsync(RedisCacheOptions),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      playground: true,
      autoSchemaFile: true, // Use in-memory schema for serverless compatibility
      sortSchema: true,
    }),
    InsightsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
