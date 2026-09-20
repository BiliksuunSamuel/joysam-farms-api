import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from '../configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { loadSchemas } from '../functions/load.schemas';
import controllers from 'src/functions/load.controllers';
import repositories from 'src/functions/load.repositories';
import services from 'src/functions/load.services';
import { JwtStrategy } from 'src/providers/jwt.strategy';
import { LocalStrategy } from 'src/providers/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import constants from 'src/constants';
import { AuthMiddleware } from 'src/middlewares/auth.middleware';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { PermissionsGuard } from 'src/providers/permissions.guard';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.development'],
      load: [configuration],
    }),
    MongooseModule.forRoot(configuration().connectionString),
    MongooseModule.forFeature(loadSchemas()),
    JwtModule.register({
      global: true,
      secret: constants().secret,
      signOptions: { expiresIn: '8hrs' },
    }),
    HttpModule.register({
      timeout: 5000,
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [...controllers],
  providers: [
    ...repositories,
    ...services,
    LocalStrategy,
    JwtStrategy,
    PermissionsGuard,
    AuditLogInterceptor,
  ],
})
export class AppModule {
  //configure middleware to check for authentication
  //you can include and exclude routes as you wish
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .exclude(
        { path: 'api/authentication/sign-in', method: RequestMethod.POST },
        { path: 'api/authentication/sign-up', method: RequestMethod.POST },
        { path: 'api/payments/paystack/webhook', method: RequestMethod.POST },
      )
      .forRoutes({
        path: '*',
        method: RequestMethod.ALL,
      });
  }
}
