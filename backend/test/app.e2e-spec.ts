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

  describe('Organization', () => {
    it('GET /api/organizations/context 返回当前成员与组织', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/organizations/context')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        organizationId: expect.any(String),
        memberId: expect.any(String),
        organization: { defaultCurrency: 'USD' },
      });
    });

    it('GET /api/organizations/members 返回成员列表', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/organizations/members')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { items: { email: string }[] };
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items[0]).toMatchObject({ email: 'demo@harvest.app' });
    });

    it('GET /api/organizations/roles 返回角色列表', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/organizations/roles')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { items: { id: string; name: string }[] };
      expect(body.items.some((r) => r.id === 'role-e2e-1')).toBe(true);
    });
  });

  describe('Clients', () => {
    it('GET /api/clients 返回 items', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/clients')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { items: { id: string; name: string }[] };
      expect(body.items.some((c) => c.id === 'client-e2e-1')).toBe(true);
    });
  });

  describe('Time entries', () => {
    it('GET /api/time-entries/assignable-rows 返回 rows', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/time-entries/assignable-rows')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { rows: { projectTaskId: string }[] };
      expect(body.rows.length).toBeGreaterThan(0);
      expect(body.rows[0]).toMatchObject({ projectTaskId: 'pt-e2e-1' });
    });

    it('GET /api/time-entries/track-time-options 返回 projects', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/time-entries/track-time-options')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { projects: { projectId: string; tasks: unknown[] }[] };
      expect(body.projects.length).toBeGreaterThan(0);
      expect(body.projects[0]?.tasks.length).toBeGreaterThan(0);
    });

    it('GET /api/time-entries?week= 返回 mode 与 items', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/time-entries')
        .query({ week: '2026-04-06' })
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { mode: string; items: unknown[] };
      expect(body.mode).toBe('week');
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe('Expenses', () => {
    it('GET /api/expenses/form-options 含 projects 与 categories', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/expenses/form-options')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as {
        projects: { id: string }[];
        categories: { id: string }[];
        defaultCurrency: string;
      };
      expect(body.defaultCurrency).toBe('USD');
      expect(body.projects.length).toBeGreaterThan(0);
      expect(body.categories.some((c) => c.id === 'cat-e2e-1')).toBe(true);
    });

    it('GET /api/expenses 返回 items', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/expenses')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { items: unknown[] };
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe('Reports', () => {
    it('GET /api/reports/filters 返回筛选项', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/reports/filters')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as {
        currency: string;
        clients: unknown[];
        projects: unknown[];
        tasks: unknown[];
      };
      expect(body.currency).toBe('USD');
      expect(Array.isArray(body.clients)).toBe(true);
      expect(Array.isArray(body.projects)).toBe(true);
      expect(Array.isArray(body.tasks)).toBe(true);
    });
  });

  describe('Approvals', () => {
    it('GET /api/approvals/meta 返回枚举配置', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/approvals/meta')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      expect(res.body).toMatchObject({
        groupBy: expect.arrayContaining(['PERSON', 'PROJECT', 'CLIENT']),
        entryStatus: expect.arrayContaining(['SUBMITTED', 'APPROVED']),
      });
    });

    it('GET /api/approvals/filters 返回 clients 与 teammates', async () => {
      const access_token = await getAccessToken();
      const res = await request(app.getHttpServer())
        .get('/api/approvals/filters')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);
      const body = res.body as { clients: unknown[]; teammates: { email: string }[] };
      expect(Array.isArray(body.clients)).toBe(true);
      expect(body.teammates.length).toBeGreaterThan(0);
    });
  });

  describe('Settings & access', () => {
    it('GET /api/settings 占位 JSON', async () => {
      const access_token = await getAccessToken();
      await request(app.getHttpServer())
        .get('/api/settings')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200)
        .expect((r) => {
          expect(r.body).toMatchObject({ module: 'settings' });
        });
    });

    it('GET /api/roles 占位列表', async () => {
      const access_token = await getAccessToken();
      await request(app.getHttpServer())
        .get('/api/roles')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200)
        .expect((r) => {
          expect(r.body).toMatchObject({ module: 'access', items: [] });
        });
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
