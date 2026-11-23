import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authConfig, parseAllowed, isAllowed, isEmail, normalizeEmail, isOtpCode, authErrorText } from '../src/domain/auth.js';

const URL = 'https://yddkxgpwrnqhuctfhkay.supabase.co';

test('configuración: con URL y clave hay login; sin alguna, no', () => {
  assert.equal(authConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: 'k' }).enabled, true);
  assert.equal(authConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).enabled, true);
  assert.equal(authConfig({ VITE_SUPABASE_URL: URL }).enabled, false);
  assert.equal(authConfig({}).enabled, false);
  assert.equal(authConfig({ VITE_SUPABASE_URL: 'https://evil.example', VITE_SUPABASE_ANON_KEY: 'k' }).enabled, false, 'solo dominios de Supabase');
  assert.equal(authConfig({ VITE_SUPABASE_URL: `${URL}/`, VITE_SUPABASE_ANON_KEY: 'k' }).url, URL);
});

test('apagar el login solo vale en desarrollo, nunca en la app publicada', () => {
  const base = { VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: 'k', VITE_AUTH_DISABLED: '1' };
  assert.equal(authConfig({ ...base, PROD: false }).enabled, false);
  assert.equal(authConfig({ ...base, PROD: true }).enabled, true);
});

test('lista de emails permitidos (segunda barrera en la app)', () => {
  assert.deepEqual(parseAllowed(' Ana@Mail.com, beto@mail.com;ana@mail.com  basura '), ['ana@mail.com', 'beto@mail.com']);
  assert.equal(isAllowed('ANA@mail.com ', ['ana@mail.com']), true);
  assert.equal(isAllowed('otro@mail.com', ['ana@mail.com']), false);
  assert.equal(isAllowed('otro@mail.com', []), true, 'sin lista local decide Supabase');
  assert.equal(isAllowed('no-es-email', []), false);
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(normalizeEmail('  A@B.CO '), 'a@b.co');
});

test('código por email y mensajes de error en castellano', () => {
  assert.equal(isOtpCode('123456'), true);
  assert.equal(isOtpCode('12a456'), false);
  assert.match(authErrorText({ message: 'Signups not allowed for otp' }), /no tiene acceso/);
  assert.match(authErrorText({ message: 'Token has expired or is invalid' }), /venció/);
  assert.match(authErrorText({ message: 'For security purposes, you can only request this after 30 seconds' }), /esperá/);
  assert.match(authErrorText(new Error('x')), /No se pudo/);
});
