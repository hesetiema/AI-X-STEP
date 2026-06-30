import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiagnosisModule } from './diagnosis/diagnosis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'traceLens-server/.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'mysql',
        host: cfg.get('DB_HOST', 'localhost'),
        port: cfg.get<number>('DB_PORT', 3306),
        username: cfg.get('DB_USERNAME', 'root'),
        password: cfg.get('DB_PASSWORD', ''),
        database: cfg.get('DB_DATABASE', 'tracelens'),
        autoLoadEntities: true,
        synchronize: true, // MVP 阶段自动建表，生产环境应关闭
      }),
    }),
    DiagnosisModule,
  ],
})
export class AppModule {}
