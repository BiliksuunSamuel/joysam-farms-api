import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import configuration from './configuration';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './middlewares/http.exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({ origin: '*' });
  app.use(bodyParser.json({ limit: '100mb' }));
  app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));

  // global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  //
  const config = new DocumentBuilder()
    .setTitle('JoySam Farms API')
    .setDescription(
      'Backend for JoySam Farms - a single-vendor, multi-shop commerce ' +
        'platform: warehouse and shop inventory, sales and checkout, ' +
        'vendor credit accounts, expenses, employees and permissions, ' +
        'and the audit log. Authenticate with POST /api/authentication/login, ' +
        'then use the token below.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'Authorization',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('/', app, document);

  //

  await app.listen(configuration().port, () => {
    console.log(
      `Server is running on http://localhost:${configuration().port}`,
    );
  });
}
bootstrap();
