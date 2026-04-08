import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SeederService } from './seeder.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        database: configService.get<string>('DB_NAME', 'meridianmed'),
        username: configService.get<string>('DB_USER', 'meridian'),
        password: configService.get<string>('DB_PASSWORD', 'dev-only-password-change-in-production'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        migrationsRun: true,
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [SeederService],
})
export class DatabaseModule {}
