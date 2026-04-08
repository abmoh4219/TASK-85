import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LabModule } from './modules/lab/lab.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { LearningModule } from './modules/learning/learning.module';
import { RulesEngineModule } from './modules/rules-engine/rules-engine.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { winstonConfig } from './config/winston.config';
import { appConfig } from './config/app.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ActionGuard } from './common/guards/action.guard';
import { AnomalyThrottlerGuard } from './common/guards/anomaly-throttler.guard';
import { NonceMiddleware } from './common/middleware/nonce.middleware';
import { AnomalyEvent } from './modules/notifications/anomaly-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    WinstonModule.forRoot(winstonConfig),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60, // Global default: generous for non-sensitive reads
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([AnomalyEvent]),
    DatabaseModule,
    AuthModule,
    ProcurementModule,
    InventoryModule,
    LabModule,
    ProjectsModule,
    LearningModule,
    RulesEngineModule,
    NotificationsModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: AnomalyThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ActionGuard },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(NonceMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
