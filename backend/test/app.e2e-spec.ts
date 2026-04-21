import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('HarvestApp API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.AUTH_DEMO_EMAIL = 'demo@harvest.app';
    process.env.AUTH_DEMO_PASSWORD = 'demo123';

    const prismaMock = {
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      $connect: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      $queryRaw: jest.fn().mockResolvedValue([1]),
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
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
