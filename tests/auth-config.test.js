const test = require('node:test');
const assert = require('node:assert/strict');

const configPath = require.resolve('../src/config');

test('JWT secrets fall back to safe defaults when ENV vars are missing', () => {
  delete process.env.ACCESS_TOKEN;
  delete process.env.REFRESH_TOKEN;
  delete require.cache[configPath];

  const { jsonWebToken } = require('../src/config');

  assert.ok(jsonWebToken.accessToken, 'access token secret must be defined');
  assert.ok(jsonWebToken.refreshToken, 'refresh token secret must be defined');
  assert.ok(jsonWebToken.accessToken.length >= 32, 'access token secret should be long enough');
  assert.ok(jsonWebToken.refreshToken.length >= 32, 'refresh token secret should be long enough');
});
