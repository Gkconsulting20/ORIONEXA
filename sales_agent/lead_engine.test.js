'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLead,
  scoreLead,
  recommendNextAction,
  listLeads
} = require('./lead_engine');

test('normalizes email and rejects missing company', () => {
  assert.equal(normalizeLead({ company: '  Acme  ', email: ' INFO@ACME.COM ' }).email, 'info@acme.com');
  assert.throws(() => normalizeLead({ email: 'test@example.com' }), /entreprise est obligatoire/i);
});

test('scores a complete, consented lead above an incomplete lead', () => {
  const complete = {
    company: 'Acme', email: 'contact@acme.com', phone: '+22890000000',
    sector: 'Services', need: 'Nous cherchons un accompagnement comptable et fiscal régulier.',
    budgetRange: '50000-100000 FCFA', consentToContact: true
  };
  const incomplete = { company: 'Prospect', need: 'Question', consentToContact: false };
  assert.ok(scoreLead(complete) > scoreLead(incomplete));
  assert.equal(scoreLead(complete), 100);
});

test('never recommends contact when permission has not been confirmed', () => {
  const next = recommendNextAction({ company: 'Acme', email: 'contact@acme.com', need: 'Comptabilité', consentToContact: false });
  assert.equal(next.action, 'VERIFY_PERMISSION');
  assert.equal(next.automated, false);
});

test('validates pipeline status before querying', async () => {
  await assert.rejects(() => listLeads({ query: async () => ({ rows: [] }) }, { status: 'INVALID' }), /Statut commercial invalide/);
});
