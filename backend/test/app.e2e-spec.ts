import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

/** 与 seed / bcrypt.hash('demo123', 12) 需一致；e2e 使用 mock 时写死同盐哈希 */
const DEMO_PASSWORD_HASH =
  '$2b$12$BiiODdj7unAjqc6hSpN5oOrglxzJb4GbEepiiz2ItS/eKBUDCEmE6';

describe('HarvestApp API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';

    const prismaMock = {
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([1]),
      $transaction: jest.fn().mockImplementation((arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === 'function') {
          return arg(prismaMock);
        }
        return Promise.resolve();
      }),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest
          .fn()
          .mockImplementation(
            (args: { where: { email?: string; id?: string } }) => {
              const email = args?.where?.email;
              if (email === 'demo@harvest.app') {
                return Promise.resolve({
                  id: 'user-e2e-1',
                  email: 'demo@harvest.app',
                  passwordHash: DEMO_PASSWORD_HASH,
                  failedLoginCount: 0,
                  lockedUntil: null,
                });
              }
              return Promise.resolve(null);
            },
          ),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      loginAttempt: {
        create: jest.fn().mockResolvedValue({}),
      },
      passwordResetToken: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };

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

  it('/api/health (GET) 无需令牌', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok', database: true });
      });
  });

  it('登录后可用 JWT 访问 /api/projects', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'demo@harvest.app', password: 'demo123' })
      .expect(200);

    const loginBody = login.body as {
      access_token: string;
    };
    expect(loginBody.access_token).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/projects')
      .set('Authorization', `Bearer ${loginBody.access_token}`)
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

  afterEach(async () => {
    await app.close();
  });
});
