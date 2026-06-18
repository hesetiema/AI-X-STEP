import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { DiagnosisController } from '../../../src/diagnosis/diagnosis.controller';
import { DiagnosisService } from '../../../src/diagnosis/services/diagnosis.service';

describe('DiagnosisController (e2e)', () => {
  let app: INestApplication;

  const diagnosisServiceMock = {
    createDiagnosis: jest.fn(),
    getDiagnosisResult: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DiagnosisController],
      providers: [
        {
          provide: DiagnosisService,
          useValue: diagnosisServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/diagnosis', () => {
    it('should create a diagnosis task and return 201 created', async () => {
      diagnosisServiceMock.createDiagnosis.mockResolvedValue({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const payload = {
        appId: 'test-app',
        pageUrl: 'https://example.com/checkout',
        title: 'Checkout page diagnosis',
        evidence: [
          {
            id: 'ev-1',
            type: 'network_error',
            label: 'POST /api/orders 500',
            value: { status: 500 },
            source: 'network-observer',
          },
        ],
        symptoms: ['ui_loading'],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/diagnosis')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'pending',
      });
      expect(diagnosisServiceMock.createDiagnosis).toHaveBeenCalledTimes(1);
      expect(diagnosisServiceMock.getDiagnosisResult).not.toHaveBeenCalled();
    });

    it('should return 400 when payload is invalid', async () => {
      const invalidPayload = {
        appId: 123,
        title: 'Test',
        evidence: 'not-an-array',
      };

      await request(app.getHttpServer())
        .post('/api/v1/diagnosis')
        .send(invalidPayload)
        .expect(400);

      expect(diagnosisServiceMock.createDiagnosis).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/diagnosis/:taskId', () => {
    it('should return diagnosis result by taskId', async () => {
      diagnosisServiceMock.getDiagnosisResult.mockResolvedValue({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
        conclusion: {
          topFindings: [],
          supportingFindings: [],
          symptomFindings: [],
          summary: 'API 5xx detected',
          state: 'root_cause_identified',
          hints: [],
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/diagnosis/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body).toMatchObject({
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        status: 'completed',
      });
      expect(diagnosisServiceMock.getDiagnosisResult).toHaveBeenCalledTimes(1);
      expect(diagnosisServiceMock.getDiagnosisResult).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
      );
      expect(diagnosisServiceMock.createDiagnosis).not.toHaveBeenCalled();
    });

    it('should return 404 when diagnosis is not found', async () => {
      diagnosisServiceMock.getDiagnosisResult.mockRejectedValue(
        new NotFoundException('Diagnosis not found'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/diagnosis/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(diagnosisServiceMock.getDiagnosisResult).toHaveBeenCalledTimes(1);
      expect(diagnosisServiceMock.createDiagnosis).not.toHaveBeenCalled();
    });
  });
});
