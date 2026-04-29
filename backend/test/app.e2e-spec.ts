import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { createE2ePrismaMock } from './e2e-prisma-mock';

describe('HarvestApp API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';

    const prismaMock = createE2ePrismaMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  async function getAccessToken(): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'demo@harvest.app', password: 'demo123' })
      .expect(200);
    return (login.body as { access_token: string }).access_token;
  }

  it('/api/health (GET) 无需令牌', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok', database: true });
      });
  });

  it('登录后可用 JWT 访问 /api/projects', async () => {
    const access_token = await getAccessToken();
    expect(access_token).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', `Bearer ${access_token}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          data: unknown[];
          meta: { page: number; pageSize: number; total: number };
        };
        expect(body.data).toBeDefined();
        expect(body.meta).toMatchObject({
          page: 1,
          pageSize: 20,
          total: 0,
        });
      });
  });

  describe('Tasks', () => {
    it('登录后 GET /api/tasks 返回 common / other 分区', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/tasks')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      const body = res.body as {
        common: { id: string; name: string; isCommon: boolean }[];
        other: { id: string; name: string; isCommon: boolean }[];
      };
      expect(body.common.some((c) => c.id === 'task-common-1')).toBe(true);
      expect(body.other.some((c) => c.id === 'task-other-1')).toBe(true);
    });

    it('GET /api/tasks/:id 可取得单条任务', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/tasks/task-common-1')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { id: string; name: string; isCommon: boolean };
      expect(body.id).toBe('task-common-1');
      expect(body.name).toBe('Common A');
    });

    it('POST 创建、PATCH 更新、归档与批量归档', async () => {
      const access_token = await getAccessToken();
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${access_token}`)
        .send({
          name: 'E2E create',
          isCommon: false,
          isBillable: true,
        })
        .expect(201);
      const newId = (created.body as { id: string }).id;
      expect(newId).toBeDefined();

      const patched = await request(app.getHttpServer())
        .patch(`/api/tasks/${newId}`)
        .set('Authorization', `Bearer ${access_token}`)
        .send({ name: 'E2E create renamed' })
        .expect(200);
      expect((patched.body as { name: string }).name).toBe('E2E create renamed');

      await request(app.getHttpServer())
        .post(`/api/tasks/${newId}/archive`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(201)
        .expect((r) => {
          expect(
            (r.body as { archived: boolean }).archived,
          ).toBe(true);
        });

      const t2 = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ name: 'E2E batch A', isCommon: false, isBillable: true })
        .expect(201);
      const id2 = (t2.body as { id: string }).id;

      const batch = await request(app.getHttpServer())
        .post('/api/tasks/batch/archive')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ ids: [id2] })
        .expect(201);
      expect((batch.body as { updated: number }).updated).toBe(1);
    });

    it('DELETE 可删除无工时的任务', async () => {
      const access_token = await getAccessToken();
      const created = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${access_token}`)
        .send({
          name: 'E2E delete me',
          isCommon: false,
          isBillable: true,
        })
        .expect(201);
      const id = (created.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/api/tasks/${id}`)
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200)
        .expect((r) => {
          expect((r.body as { deleted: boolean }).deleted).toBe(true);
        });
    });

    it('GET /api/tasks/export?format=json 为附件式 JSON', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/tasks/export')
        .query({ format: 'json' })
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(String(res.header['content-type'] || '')).toMatch(/json/);
      expect(
        (res.text || '').length,
      ).toBeGreaterThan(0);
      const parsed = JSON.parse(res.text) as { version: number; items: unknown[] };
      expect(parsed.version).toBe(1);
      expect(Array.isArray(parsed.items)).toBe(true);
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
