import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/health/live (GET) is public and returns ok', () => {
    return request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') {
          throw new Error(`expected status ok, got ${res.body.status}`);
        }
      });
  });

  it('/api/v1/users/me (GET) requires auth', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });
});
