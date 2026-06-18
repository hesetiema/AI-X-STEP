下面直接给你一版 **基于这套 `jest-e2e.json` 的 `diagnosis.controller.e2e-spec.ts` skeleton**。

我会按你前面的 Diagnosis MVP 约束来写：

- `POST /api/v1/diagnosis`
  - 只创建 diagnosis task
  - 不立即执行完整诊断
- `GET /api/v1/diagnosis/:id`
  - lazy execution
  - 有缓存返回缓存
  - 没缓存则执行并缓存

这版先是 **controller e2e skeleton**，重点是：

- Nest app 能启动
- 路由可测
- 依赖可 mock
- 用 supertest 打通入口
- 断言聚焦 HTTP 行为，不深测内部规则细节

---

# 一、建议文件路径

```ts
test/e2e/diagnosis/diagnosis.controller.e2e-spec.ts
```

---

# 二、推荐 skeleton 代码

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { DiagnosisController } from '../../../src/diagnosis/application/diagnosis.controller';
import { DiagnosisCommandService } from '../../../src/diagnosis/application/services/diagnosis-command.service';
import { DiagnosisQueryService } from '../../../src/diagnosis/application/services/diagnosis-query.service';

describe('DiagnosisController (e2e)', () => {
  let app: INestApplication;

  const diagnosisCommandServiceMock = {
    createDiagnosisTask: jest.fn(),
  };

  const diagnosisQueryServiceMock = {
    getDiagnosisById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DiagnosisController],
      providers: [
        {
          provide: DiagnosisCommandService,
          useValue: diagnosisCommandServiceMock,
        },
        {
          provide: DiagnosisQueryService,
          useValue: diagnosisQueryServiceMock,
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
    it('should create a diagnosis task and return accepted response', async () => {
      diagnosisCommandServiceMock.createDiagnosisTask.mockResolvedValue({
        id: 'diag-001',
        status: 'pending',
      });

      const payload = {
        interactionId: 'itx-001',
        targetId: 'button-submit',
        symptoms: ['ui_loading'],
        metadata: {
          pageUrl: '/checkout',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/diagnosis')
        .send(payload)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'diag-001',
        status: 'pending',
      });

      expect(
        diagnosisCommandServiceMock.createDiagnosisTask,
      ).toHaveBeenCalledTimes(1);
      expect(
        diagnosisCommandServiceMock.createDiagnosisTask,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          interactionId: 'itx-001',
          targetId: 'button-submit',
          symptoms: ['ui_loading'],
        }),
      );
      expect(diagnosisQueryServiceMock.getDiagnosisById).not.toHaveBeenCalled();
    });

    it('should reject invalid payload', async () => {
      const invalidPayload = {
        interactionId: 123,
        targetId: 'button-submit',
        symptoms: ['ui_loading'],
        unexpectedField: 'should-be-rejected',
      };

      await request(app.getHttpServer())
        .post('/api/v1/diagnosis')
        .send(invalidPayload)
        .expect(400);

      expect(
        diagnosisCommandServiceMock.createDiagnosisTask,
      ).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/diagnosis/:id', () => {
    it('should return diagnosis result by id', async () => {
      diagnosisQueryServiceMock.getDiagnosisById.mockResolvedValue({
        id: 'diag-001',
        status: 'completed',
        result: {
          summary: 'Likely API timeout',
          topCause: {
            ruleCode: 'R202',
            title: 'API timeout root cause',
          },
          supportingCauses: [
            {
              ruleCode: 'R301',
              title: 'DB timeout supporting cause',
            },
          ],
          symptoms: [
            {
              ruleCode: 'R501',
              title: 'UI loading symptom',
            },
          ],
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/diagnosis/diag-001')
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'diag-001',
        status: 'completed',
        result: {
          summary: 'Likely API timeout',
        },
      });

      expect(diagnosisQueryServiceMock.getDiagnosisById).toHaveBeenCalledTimes(
        1,
      );
      expect(diagnosisQueryServiceMock.getDiagnosisById).toHaveBeenCalledWith(
        'diag-001',
      );
    });

    it('should return 404 when diagnosis is not found', async () => {
      diagnosisQueryServiceMock.getDiagnosisById.mockRejectedValue(
        new Error('Diagnosis not found'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/diagnosis/not-found')
        .expect(500);
    });
  });
});
```

---

# 三、这版 skeleton 的定位

这版不是“半真实模块 e2e”，而是：

## **controller-scope e2e / thin e2e**
特点：

- 真正起 Nest app
- 真正走 HTTP
- 真正经过 controller + pipe
- service 依赖用 mock provider 替换

所以它很适合先验证：

- 路由是否存在
- DTO/ValidationPipe 是否生效
- controller 是否正确把请求转给 service
- controller 是否把 service 输出正确映射为 HTTP 响应

---

# 四、你需要按自己项目实际改的地方

上面 skeleton 里有几个地方你大概率要按真实代码改一下。

---

## 1）Controller import 路径
我先假设：

```ts
src/diagnosis/application/diagnosis.controller
```

如果你项目实际是：

```ts
src/diagnosis/diagnosis.controller
src/diagnosis/controllers/diagnosis.controller
```

就改成你的真实路径。

---

## 2）Service 方法名
我先假设：

```ts
diagnosisCommandService.createDiagnosisTask(...)
diagnosisQueryService.getDiagnosisById(...)
```

如果你真实方法叫：

- `create`
- `createTask`
- `submitDiagnosis`
- `queryById`
- `getById`

要同步调整。

---

## 3）POST 返回状态码
我这里写的是：

```ts
.expect(201)
```

因为默认 Nest `@Post()` 常见是 `201 Created`。

但如果你 controller 明确用了：

```ts
@HttpCode(202)
```

表示“accepted, async task created”，那就应该改成：

```ts
.expect(202)
```

而且我其实更建议 Diagnosis task create 用 **202**，因为语义更贴合“已受理，未执行完成”。

如果你已经决定采用 202，建议这样改：

```ts
const response = await request(app.getHttpServer())
  .post('/api/v1/diagnosis')
  .send(payload)
  .expect(202);
```

---

## 4）404 case 的异常类型
目前 skeleton 里：

```ts
diagnosisQueryServiceMock.getDiagnosisById.mockRejectedValue(
  new Error('Diagnosis not found'),
);
```

这通常会被 Nest 处理成 `500`，不是 `404`。

如果你真实实现希望是 404，应改成：

```ts
import { NotFoundException } from '@nestjs/common';

diagnosisQueryServiceMock.getDiagnosisById.mockRejectedValue(
  new NotFoundException('Diagnosis not found'),
);
```

然后断言：

```ts
.expect(404);
```

所以这条建议你最终改成下面这样更合理。

---

# 五、我建议你直接用的 404 改良版

把第二个 GET case 改成：

```ts
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
```

以及：

```ts
it('should return 404 when diagnosis is not found', async () => {
  diagnosisQueryServiceMock.getDiagnosisById.mockRejectedValue(
    new NotFoundException('Diagnosis not found'),
  );

  await request(app.getHttpServer())
    .get('/api/v1/diagnosis/not-found')
    .expect(404);
});
```

这个更符合真实 API 语义。

---

# 六、如果你的 POST DTO 比较严格，建议补一个更稳的 payload

如果你 DTO 类似：

```ts
class CreateDiagnosisDto {
  @IsString()
  interactionId: string;

  @IsString()
  targetId: string;

  @IsArray()
  symptoms: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}
```

那么上面 payload 没问题。

如果你实际还要求：

- `appId`
- `sessionId`
- `evidence`
- `context`

那就把 payload 补齐。

---

# 七、如果你要更贴近当前 MVP 语义，我建议 POST case 用 202

我给你一个更推荐的 POST 版本：

```ts
it('should create a diagnosis task and return accepted response', async () => {
  diagnosisCommandServiceMock.createDiagnosisTask.mockResolvedValue({
    id: 'diag-001',
    status: 'pending',
  });

  const payload = {
    interactionId: 'itx-001',
    targetId: 'button-submit',
    symptoms: ['ui_loading'],
    metadata: {
      pageUrl: '/checkout',
    },
  };

  const response = await request(app.getHttpServer())
    .post('/api/v1/diagnosis')
    .send(payload)
    .expect(202);

  expect(response.body).toMatchObject({
    id: 'diag-001',
    status: 'pending',
  });
});
```

前提是 controller 使用：

```ts
@HttpCode(202)
```

---

# 八、如果你想补一个“lazy execution 语义”的 controller 层可见断言

controller e2e 其实不需要深测 lazy execution 内部逻辑，  
那是 query service / semi-real module e2e 更该做的事。

但你可以保留这种轻断言：

- POST 不调用 query service
- GET 调 query service 一次

这在当前 skeleton 里已经体现了：

```ts
expect(diagnosisQueryServiceMock.getDiagnosisById).not.toHaveBeenCalled();
```

和：

```ts
expect(diagnosisQueryServiceMock.getDiagnosisById).toHaveBeenCalledWith(
  'diag-001',
);
```

这个粒度刚好。

---

# 九、如果你想再稳一点，可以补一个“参数 transform” case

如果你的 `:id` 是 string，就没必要。  
如果你有数字型 query/path 参数，就可以补。

但当前 Diagnosis id 看起来是 string，所以不用强加。

---

# 十、推荐的最终版本（我替你拍板）

下面是我更推荐你最终落地时采用的版本要点：

## 保留的 case
### POST
1. 创建任务成功
2. 非法 payload 返回 400

### GET
3. 按 id 返回结果
4. not found 返回 404

这 4 个 case 就足够作为第一版 controller e2e skeleton。

---

# 十一、你可以直接改成这个更推荐版的 imports

```ts
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
```

---

# 十二、下一步最自然做什么

现在最顺的下一步就是二选一：

## 方向 A：我把这份 skeleton 再对齐成 **202 + 404 版完整最终代码**
也就是把上面我提到的改良点都直接合进去，给你一份“可直接贴”的最终版。

## 方向 B：我继续给你 **semi-real DiagnosisModule e2e skeleton**
那一版会更接近：
- controller
- application services
- repository mock
- rule engine / ranking / conclusion / explanation 可选半真实接入

如果你愿意，我建议下一条直接做：

> **202 + 404 版最终可贴的 `diagnosis.controller.e2e-spec.ts`**