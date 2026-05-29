import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
<<<<<<< HEAD
=======
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
>>>>>>> feature/analytics

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

<<<<<<< HEAD
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });

  await app.listen(3000);
=======
  const config = new DocumentBuilder()
    .setTitle('SmartQ API')
    .setDescription('Система управления очередью')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
>>>>>>> feature/analytics
}
bootstrap();