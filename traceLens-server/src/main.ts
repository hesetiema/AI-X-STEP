import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { execSync } from 'child_process';

async function bootstrap() {
  const port = 8080;

  // MVP: 启动前自动杀掉占用端口的旧进程，避免 EADDRINUSE
  try {
    const output = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
    const lines = output.trim().split(/\r?\n/).filter((l) => l.includes('LISTENING'));
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) {
        execSync(`taskkill //F //PID ${pid}`, { stdio: 'ignore' });
      }
    }
  } catch {}

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.enableCors();
  await app.listen(port);
  console.log(`TraceLens server running on http://localhost:${port}`);
}
bootstrap();
