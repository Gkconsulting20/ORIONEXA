'use strict';

const ALLOWED_STATUSES = new Set([
  'NEW', 'QUALIFIED', 'CONTACTED', 'MEETING', 'PROPOSAL', 'WON', 'LOST'
]);

function cleanString(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function normalizeLead(input = {}) {
  const lead = {
    company: cleanString(input.company, 160),
    contactName: cleanString(input.contactName, 160),
    email: cleanString(input.email, 254).toLowerCase(),
    phone: cleanString(input.phone, 40),
    sector: cleanString(input.sector, 100),
    need: cleanString(input.need, 2000),
    source: cleanString(input.source || 'manual', 80),
    budgetRange: cleanString(input.budgetRange, 80),
    consentToContact: input.consentToContact === true,
    status: cleanString(input.status || 'NEW', 20).toUpperCase()
  };

  if (!lead.company) throw new TypeError('Le nom de l’entreprise est obligatoire.');
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    throw new TypeError('Adresse email invalide.');
  }
  if (!ALLOWED_STATUSES.has(lead.status)) throw new TypeError('Statut commercial invalide.');
  return lead;
}

function scoreLead(input = {}) {
  const lead = normalizeLead(input);
  let score = 0;
  if (lead.need.length >= 40) score += 30;
  else if (lead.need.length > 0) score += 15;
  if (lead.budgetRange) score += 20;
  if (lead.email) score += 15;
  if (lead.phone) score += 10;
  if (lead.sector) score += 10;
  if (lead.consentToContact) score += 15;
  return Math.min(100, score);
}

function recommendNextAction(input = {}) {
  const lead = normalizeLead(input);
  if (!lead.consentToContact) {
    return { action: 'VERIFY_PERMISSION', label: 'Vérifier la base légale avant toute prise de contact', automated: false };
  }
  if (!lead.need) {
    return { action: 'CLARIFY_NEED', label: 'Préciser le besoin du prospect', automated: false };
  }
  if (!lead.email && !lead.phone) {
    return { action: 'COMPLETE_CONTACT', label: 'Compléter les coordonnées professionnelles', automated: false };
  }
  if (lead.status === 'NEW' || lead.status === 'QUALIFIED') {
    return { action: 'REVIEW_AND_CONTACT', label: 'Examiner le dossier puis contacter manuellement', automated: false };
  }
  if (lead.status === 'CONTACTED') {
    return { action: 'PROPOSE_MEETING', label: 'Proposer un rendez-vous si le prospect le souhaite', automated: false };
  }
  if (lead.status === 'MEETING') {
    return { action: 'PREPARE_PROPOSAL', label: 'Préparer une proposition adaptée', automated: false };
  }
  return { action: 'REVIEW_PIPELINE', label: 'Vérifier la prochaine étape du pipeline', automated: false };
}

async function ensureLeadTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orionexa_sales_leads (
      id BIGSERIAL PRIMARY KEY,
      company VARCHAR(160) NOT NULL,
      contact_name VARCHAR(160) NOT NULL DEFAULT '',
      email VARCHAR(254) NOT NULL DEFAULT '',
      phone VARCHAR(40) NOT NULL DEFAULT '',
      sector VARCHAR(100) NOT NULL DEFAULT '',
      need TEXT NOT NULL DEFAULT '',
      source VARCHAR(80) NOT NULL DEFAULT 'manual',
      budget_range VARCHAR(80) NOT NULL DEFAULT '',
      consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(20) NOT NULL DEFAULT 'NEW'
        CHECK (status IN ('NEW','QUALIFIED','CONTACTED','MEETING','PROPOSAL','WON','LOST')),
      score SMALLINT NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createLead(pool, input) {
  const lead = normalizeLead(input);
  const score = scoreLead(lead);
  const result = await pool.query(
    `INSERT INTO orionexa_sales_leads
      (company, contact_name, email, phone, sector, need, source, budget_range, consent_to_contact, status, score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, company, contact_name, email, phone, sector, need, source, budget_range,
               consent_to_contact, status, score, created_at, updated_at`,
    [lead.company, lead.contactName, lead.email, lead.phone, lead.sector, lead.need,
     lead.source, lead.budgetRange, lead.consentToContact, lead.status, score]
  );
  return result.rows[0];
}

async function listLeads(pool, { status, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number.isInteger(limit) ? limit : 50));
  const safeOffset = Math.max(0, Number.isInteger(offset) ? offset : 0);
  if (status && !ALLOWED_STATUSES.has(status)) throw new TypeError('Statut commercial invalide.');
  const values = status ? [status, safeLimit, safeOffset] : [safeLimit, safeOffset];
  const where = status ? 'WHERE status = $1' : '';
  const limitIndex = status ? '$2' : '$1';
  const offsetIndex = status ? '$3' : '$2';
  const result = await pool.query(
    `SELECT id, company, contact_name, email, phone, sector, need, source, budget_range,
            consent_to_contact, status, score, created_at, updated_at
       FROM orionexa_sales_leads ${where}
      ORDER BY score DESC, updated_at DESC
      LIMIT ${limitIndex} OFFSET ${offsetIndex}`,
    values
  );
  return result.rows;
}

async function updateLeadStatus(pool, id, status) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1) throw new TypeError('Identifiant invalide.');
  const normalizedStatus = cleanString(status, 20).toUpperCase();
  if (!ALLOWED_STATUSES.has(normalizedStatus)) throw new TypeError('Statut commercial invalide.');
  const result = await pool.query(
    'UPDATE orionexa_sales_leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, company, status, score, updated_at',
    [normalizedStatus, Number(id)]
  );
  return result.rows[0] || null;
}

module.exports = {
  ALLOWED_STATUSES,
  normalizeLead,
  scoreLead,
  recommendNextAction,
  ensureLeadTable,
  createLead,
  listLeads,
  updateLeadStatus
};
