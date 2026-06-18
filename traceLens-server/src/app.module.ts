import { Module } from '@nestjs/common';
import { DiagnosisModule } from './diagnosis/diagnosis.module';

@Module({
  imports: [DiagnosisModule],
})
export class AppModule {}
