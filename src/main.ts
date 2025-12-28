import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const expressApp = express();
let cachedApp: express.Express | null = null;

async function bootstrap(): Promise<express.Express> {
  if (cachedApp) {
    return cachedApp;
  }

  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  app.enableCors();
  await app.init();

  cachedApp = expressApp;
  return expressApp;
}

// For serverless deployment (Vercel/AWS Lambda)
export default async function handler(req: express.Request, res: express.Response) {
  const app = await bootstrap();
  app(req, res);
}

// For local development
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then((app) => {
    const port = process.env.PORT ?? 3000;
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  });
}


// package.json determines how it RUNS
// The "type": "module" field in package.json tells the Node.js runtime (on Vercel) how to interpret .js files: 
// With "type": "module": Node treats .js files as ES Modules (ESM).
// Without it: Node defaults to CommonJS (CJS), means it changes how node js interprets the js files, without this you can no longer use require() and module.exports.
// 2. tsconfig.json determines how it BUILDS
// The module setting in tsconfig.json tells the TypeScript compiler (tsc) what kind of JavaScript code to output during the build phase:
// "module": "commonjs": TypeScript converts your import/export syntax into require() and module.exports.
// "module": "esnext": TypeScript keeps modern import/export syntax in the final JavaScript files.