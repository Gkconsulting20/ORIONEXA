'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerSalesRoutes } = require('./sales');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function fakeApp() {
  const routes = new Map();
  return {
    routes,
    get(path, ...handlers) { routes.set('GET ' + path, handlers); },
    post(path, ...handlers) { routes.set('POST ' + path, handlers); },
    patch(path, ...handlers) { routes.set('PATCH ' + path, handlers); }
  };
}

test('all sales API routes require the supplied admin middleware', () => {
  const app = fakeApp();
  const pool = { query: async () => ({ rows: [] }) };
  const admin = (_req, _res, next) => next();
  registerSalesRoutes(app, pool, admin);
  for (const handlers of app.routes.values()) {
    assert.equal(handlers[0], admin);
  }
});

test('create prospect validates input and returns next action without sending messages', async () => {
  const app = fakeApp();
  const admin = (_req, _res, next) => next();
  const pool = {
    async query(sql, values) {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('INSERT INTO orionexa_sales_leads')) {
        return { rows: [{
          id: 1, company: values[0], contact_name: values[1], email: values[2],
          phone: values[3], sector: values[4], need: values[5], source: values[6],
          budget_range: values[7], consent_to_contact: values[8], status: values[9],
          score: values[10]
        }] };
      }
      throw new Error('Unexpected SQL');
    }
  };
  registerSalesRoutes(app, pool, admin);
  const handlers = app.routes.get('POST /api/sales/leads');
  const res = response();
  await handlers[1]({
    body: { company: 'Acme', email: 'contact@acme.com', need: 'Service comptable', consentToContact: false },
    query: {}
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.nextAction.action, 'VERIFY_PERMISSION');
  assert.equal(res.body.nextAction.automated, false);
});

test('invalid prospect returns 400 without writing a lead', async () => {
  const app = fakeApp();
  let inserted = false;
  const admin = (_req, _res, next) => next();
  const pool = { async query(sql) {
    if (sql.includes('CREATE TABLE')) return { rows: [] };
    inserted = true;
    return { rows: [] };
  } };
  registerSalesRoutes(app, pool, admin);
  const res = response();
  await app.routes.get('POST /api/sales/leads')[1]({ body: { email: 'invalid' }, query: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(inserted, false);
});
