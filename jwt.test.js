/**
 * @jest-environment node
 */

const request = require('supertest');
const mysql = require('mysql2/promise');

const env = process.env.NODE_ENV || 'test';
const config = require(__dirname + '/_cloned-app/server/config/config.json')[env];
let connection;
 
const app = require('./_cloned-app/server/app');
const username = 'guy';
const otherUsername = 'guy55';
const password = '123456';

let token;

const projectName = '1.Tickets manager backend';
describe(projectName, () => {
  beforeAll(async () => {
    connection = await mysql.createConnection({
      host: config.host,
      user: config.username,
      password: config.password,
      database: config.database
    });
    try {
      await connection.query('TRUNCATE TABLE `Users`');
    } catch(e) {
      console.log('Part of the tables are missing')
    }
  });

  afterAll(async () => {
    await connection.end();
  });

  describe("Users", () => {
    test('Can create user', async () => {
      const { body } = await request(app)
        .post('/api/users').send({ username, password })
        .expect(200)

      await request(app)
        .post('/api/users').send({ username: otherUsername, password })
        .expect(200)

      expect(body.status).toBe('ok');
      const [res] = await connection.query('SELECT * FROM `Users`');
      expect(res.length).toBeGreaterThanOrEqual(1);
      expect(res[0].username).toBe(username);
      expect(res[0].password).toBe(password);
    });
    test('Cant create user with the same username', async () => {
      const { body } = await request(app)
        .post('/api/users').send({ username, password })
        .expect(500)
    });
  })

  describe("Login", () => {
    test('Get status 500 when login failed', async () => {
      const { body } = await request(app)
        .post('/api/login').send({ username, password: 'other' })
        .expect(500)
    });
    test('Can login', async () => {
      const { body } = await request(app)
        .post('/api/login').send({ username, password })
        .expect(200)

      token = body.token;

      const { body: otherUserLoginBody } = await request(app)
        .post('/api/login').send({ username: otherUsername, password })
        .expect(200)

      tokenOtherUser = otherUserLoginBody.token;
    });
  })
})
