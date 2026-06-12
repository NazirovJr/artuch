import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://localhost:8083',
      'https://artuch.org',
      'https://www.artuch.org',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown fields so garbage/probing never reaches the DB. We
      // deliberately do NOT set `forbidNonWhitelisted` globally: flipping
      // silent-strip to a hard 400 on a live system risks breaking any form
      // that sends an extra field. Enable it per-endpoint after auditing
      // each DTO's real payload.
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger UI at /api/docs (spec at /api/docs-json). Off in production by
  // default — the staff API isn't a public contract; flip SWAGGER_ENABLED=1
  // to expose it behind your own network controls.
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === '1') {
    const config = new DocumentBuilder()
      .setTitle('Artuch ERP API')
      .setDescription('Hospitality ERP — hotel, restaurant, POS, warehouse, finance')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(3000, '0.0.0.0');
  console.log('Backend running on http://localhost:3000');
}
bootstrap();
