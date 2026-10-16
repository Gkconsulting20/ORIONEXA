// Copies application data only. Source PostgreSQL/files are never modified.
// Private values remain in memory and are never printed or written to Git.
// Usage: node scripts/copy-cloudflare-data.mjs [--remote]
// Requires source DATABASE_URL; --remote also requires CLOUDFLARE_API_TOKEN (D1 Edit).
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const account = "16ae307025f61c0701788f91f614a192";
const config = JSON.parse(await readFile(path.join(root, "wrangler.jsonc"), "utf8"));
const database = config.d1_databases.find(x => x.binding === "DB").database_id;
const remote = process.argv.includes("--remote");
const text = value => value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
async function jsonFile(name) {
  try {
    const records = JSON.parse(await readFile(path.join(root, name), "utf8"));
    if (!Array.isArray(records)) throw new Error(`Expected array: ${name}`);
    return records;
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
async function query(sql, params) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ sql, ...(params ? { params: params.map(text) } : {}) }),
      signal: AbortSignal.timeout(30000)
    }
  );
  const result = await response.json();
  if (!response.ok || !result.success || result.result?.some(x => x.success === false)) {
    // API errors can echo private query parameters; don't print their bodies.
    throw new Error(`Cloudflare D1 request failed (HTTP ${response.status}).`);
  }
  return result.result;
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Source DATABASE_URL is required.");
  if (remote && !process.env.CLOUDFLARE_API_TOKEN) throw new Error("Cloudflare API token is required.");
  if (/^0{8}-/.test(database)) throw new Error("Configure a real destination database first.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let rows;
  try {
    await pool.query("BEGIN TRANSACTION READ ONLY");
    rows = (await pool.query(
      "SELECT prenom, nom, email, entreprise, secteur, active, created_at FROM newsletter_subscribers"
    )).rows;
    await pool.query("ROLLBACK");
  } finally {
    await pool.end();
  }
  const unique = new Map();
  for (const row of [...rows, ...await jsonFile("data/newsletter-subscribers.json")]) {
    const email = text(row.email).trim();
    if (!email || !email.includes("@")) throw new Error("Invalid subscriber in source; stopped.");
    const key = email.toLowerCase();
    const values = {
      prenom: text(row.prenom), nom: text(row.nom), email,
      entreprise: text(row.entreprise), secteur: text(row.secteur),
      active: row.active === false || row.active === 0 ? 0 : 1,
      created_at: text(row.created_at ?? row.createdAt ?? row.date)
    };
    if (!unique.has(key)) unique.set(key, values);
    // Never reactivate a subscriber who opted out in either source.
    else if (values.active === 0) unique.get(key).active = 0;
  }
  const newsletters = await jsonFile("data/newsletters/index.json");
  const contacts = await jsonFile("data/contacts.json");
  const quotes = await jsonFile("data/devis.json");
  const appointments = await jsonFile("data/appointments.json");
  const inventory = {
    subscribers: unique.size, newsletters: newsletters.length,
    contacts: contacts.length, quotes: quotes.length, appointments: appointments.length
  };
  console.log("Source inventory (workspace PostgreSQL and local files):", inventory);
  if (!remote) return console.log("Dry run: no writes made.");
  // Non-destructive, rerunnable schema setup in the destination only.
  await query(await readFile(path.join(root, "cloudflare/migrations/0001_initial.sql"), "utf8"));
  let verified = 0;
  for (const row of unique.values()) {
    const values = Object.values(row);
    await query(
      "INSERT OR IGNORE INTO newsletter_subscribers (prenom,nom,email,entreprise,secteur,active,created_at) VALUES (?,?,?,?,?,?,COALESCE(NULLIF(?,''),CURRENT_TIMESTAMP))",
      values
    );
    const saved = (await query(
      "SELECT prenom,nom,email,entreprise,secteur,active,created_at FROM newsletter_subscribers WHERE email=? COLLATE NOCASE",
      [row.email]
    ))[0].results[0];
    if (!saved || Object.keys(row).some(k =>
      (k !== "created_at" || row.created_at) && text(saved[k]) !== text(row[k])
    )) throw new Error("Subscriber destination differs from source; not overwritten.");
    verified++;
  }
  const digest = value => createHash("sha256").update(value).digest("hex");
  for (const item of newsletters) {
    if (!Number.isSafeInteger(item.issue) || item.issue < 1) throw new Error("Invalid newsletter issue.");
    const html = await readFile(path.join(root, "data/newsletters", `newsletter-${item.issue}.html`), "utf8");
    const params = [
      item.issue, item.subject, item.date, item.createdAt, item.status || "generated",
      item.sentCount || 0, item.sentAt, html
    ];
    await query(
      "INSERT OR IGNORE INTO generated_newsletters (issue,subject,date,created_at,status,sent_count,sent_at,html_content) VALUES (?,?,?,COALESCE(NULLIF(?,''),CURRENT_TIMESTAMP),?,?,NULLIF(?,''),?)",
      params
    );
    const saved = (await query("SELECT * FROM generated_newsletters WHERE issue=?", [item.issue]))[0].results[0];
    if (!saved || digest(saved.html_content) !== digest(html) ||
        saved.subject !== text(item.subject) || saved.date !== text(item.date) ||
        (item.createdAt && saved.created_at !== text(item.createdAt)) ||
        text(saved.sent_at) !== text(item.sentAt) ||
        saved.status !== text(item.status || "generated") ||
        Number(saved.sent_count) !== Number(item.sentCount || 0)) {
      throw new Error("Newsletter destination differs from source; not overwritten.");
    }
    verified++;
  }
  for (const contact of contacts) {
    const values = [contact.name, contact.email, contact.message, contact.date ?? contact.createdAt];
    if (values.some(v => !text(v))) throw new Error("Incomplete source contact; stopped.");
    await query(
      "INSERT INTO contact_requests (name,email,message,created_at) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM contact_requests WHERE name=? AND email=? AND message=? AND created_at=?)",
      [...values, ...values]
    );
    const found = (await query("SELECT count(*) AS total FROM contact_requests WHERE name=? AND email=? AND message=? AND created_at=?", values))[0].results[0].total;
    if (!found) throw new Error("Contact verification failed.");
    verified++;
  }
  for (const [table, records] of [["quote_requests", quotes], ["appointments", appointments]]) {
    for (const record of records) {
      const payload = JSON.stringify(record);
      const date = text(record.createdAt ?? record.date);
      if (!date) throw new Error("Source request is missing its date.");
      await query(
        `INSERT INTO ${table} (payload_json,created_at) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE payload_json=? AND created_at=?)`,
        [payload, date, payload, date]
      );
      const found = (await query(`SELECT count(*) AS total FROM ${table} WHERE payload_json=? AND created_at=?`, [payload, date]))[0].results[0].total;
      if (!found) throw new Error("Request verification failed.");
      verified++;
    }
  }
  console.log(`Verified ${verified} source records in Cloudflare D1. No Replit source data changed.`);
}
main().catch(error => {
  // Avoid printing underlying PostgreSQL errors, which may contain private data.
  console.error(error.code ? "Source database read failed." : error.message);
  process.exitCode = 1;
});
