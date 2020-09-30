/**
 * @jest-environment node
 */

const request = require('supertest');
const mysql = require('mysql2/promise');
const puppeteer = require('puppeteer');
const nock = require('nock');
const useNock = require('nock-puppeteer');

const env = process.env.NODE_ENV || 'test';
const config = require(__dirname + '/../_cloned-app/server/config/config.json')[env];
let connection;
 
const app = require('../_cloned-app/server/app');
const username = 'guy';
const otherUsername = 'guy55';
const password = '123456';

let token;

const projectName = 'backend testing';
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

let page;
let browser;

jest.setTimeout(30000);
const projectName = 'client testing';
describe(projectName, () => {
  beforeAll(async () => {
    browser = await puppeteer.launch();
    page = await browser.newPage();
    useNock(page, ['http://localhost:3000/api']);
  });
  afterAll(async () => {
    await browser.close();
  });

  const mockUser = {
    username: 'myfakeusername',
    password: 'myfakepass',
    picture: 'https://i.picsum.photos/id/523/536/354.jpg?hmac=OaAEhfqLAFNi0-3hVrDaBqXIqz4JvfbXa38gNi6EN7c',
  };

  describe('Register Page', () => {
    test('Call api/register after submit register form', async () => {
      await page.goto('http://localhost:3000/register');
      const registerMock = await nock('http://localhost:3000/', { allowUnmocked: true })
        .post('/api/users', ({ username, password, picture }) => username === mockUser.username
          && password === mockUser.password && picture === mockUser.picture)
        .reply(200, { status: 'ok' });
      await page.type('#username', mockUser.username);
      await page.type('#password', mockUser.password);
      await page.type('#picture', mockUser.picture);
      await page.click('#submit');
      expect(registerMock.isDone()).toBe(true)
      await (new Promise((resolve) => setTimeout(resolve, 1500)));
      const elements = await page.$$('#errorMessage');
      expect(elements.length).toBe(0);
    })
    test('Show error message when the user is already exist or when other issue', async () => {
      await page.goto('http://localhost:3000/register');
      const registerMock = await nock('http://localhost:3000/', { allowUnmocked: true })
        .post('/api/users', ({ username, password, picture }) => username === mockUser.username
          && password === mockUser.password && picture === mockUser.picture)
        .reply(500, { status: 'ok' });
      await page.type('#username', mockUser.username);
      await page.type('#password', mockUser.password);
      await page.type('#picture', mockUser.picture);
      await page.click('#submit');
      expect(registerMock.isDone()).toBe(true)
      await (new Promise((resolve) => setTimeout(resolve, 1500)));
      const elements = await page.$$('#errorMessage');
      expect(elements.length).toBe(1);
    })
  })
  describe('Login page', () => {
    test('If login fail show error message', async () => {
      const loginMock = await nock('http://localhost:3000/', { allowUnmocked: true })
        .post('/api/login', ({ username, password }) => username === mockUser.username
          && password === mockUser.password)
        .reply(500, { status: 'ok' });
      await page.goto('http://localhost:3000/');
      await page.type('#username', mockUser.username);
      await page.type('#password', mockUser.password);
      await page.click('#login');
      await (new Promise((resolve) => setTimeout(resolve, 1500)));
      const elements = await page.$$('#errorMessage');
      expect(elements.length).toBe(1);
      expect(loginMock.isDone()).toBe(true)
    });
    test('Can login - will call server with post api/login', async () => {
      const loginMock = await nock('http://localhost:3000/', { allowUnmocked: true })
        .post('/api/login', ({ username, password }) => username === mockUser.username
          && password === mockUser.password)
        .reply(200, { token: 'sometoken' });
      await page.goto('http://localhost:3000/');
      await page.type('#username', mockUser.username);
      await page.type('#password', mockUser.password);
      let currentUrl = await page.url();
      // expect redirect from / to /login for user how not logged in
      expect(currentUrl).toBe('http://localhost:3000/login')
      await page.click('#login');
      await (new Promise((resolve) => setTimeout(resolve, 1500)));
      const elements = await page.$$('#errorMessage');
      expect(elements.length).toBe(0);
      expect(loginMock.isDone()).toBe(true)
      currentUrl = await page.url();
      expect(currentUrl).toBe('http://localhost:3000/')
    });
  });
})
