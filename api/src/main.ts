import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IndicF5 Bengali TTS API')
    .setDescription(
      'Text-to-speech service around ai4bharat/IndicF5. Register to get an API key, then authorize with the button above.\n\n' +
        'All responses use one envelope: `{ success, statusCode, message, data, meta? }`. ' +
        'Errors: `{ success: false, statusCode, message, error }`.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const config = app.get(ConfigService);
  await app.listen(config.get<number>('port') ?? 3000);
}
void bootstrap();
