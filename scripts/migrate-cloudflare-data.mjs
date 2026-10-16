import { Pool } from "pg";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseName = "orionexa-data";

function sqlText(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  if (typeof record.email !== "string" || !record.email.trim()) return null;
  const createdAt = record.created_at ?? record.createdAt ?? record.date ?? null;
  return {
    prenom: record.prenom ?? null,
    nom: record.nom ?? null,
    email: record.email.trim(),
    entreprise: record.entreprise ?? null,
    secteur: record.secteur ?? null,
    active: record.active === false || record.active === 0 ? 0 : 1,
    createdAt:
      createdAt instanceof Date
        ? createdAt.toISOString()
        : createdAt
          ? String(createdAt)
          : null
  };
}

async function collectSubscribers() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is unavailable; run this from the source project.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const records = [];

  try {
    try {
      const result = await pool.query(
        "SELECT prenom, nom, email, entreprise, secteur, active, created_at FROM newsletter_subscribers"
      );
      records.push(...result.rows);
    } catch (error) {
      if (error.code !== "42P01") throw error;
      console.warn("The source PostgreSQL table is absent; importing the legacy file only.");
    }
  } finally {
    await pool.end();
  }

  const legacyPath = path.join(projectRoot, "data", "newsletter-subscribers.json");
  try {
    const parsed = JSON.parse(await readFile(legacyPath, "utf8"));
    if (!Array.isArray(parsed)) {
      throw new Error("The legacy subscriber file must contain a JSON array.");
    }
    records.push(...parsed);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const unique = new Map();
  for (const raw of records) {
    const record = normalizeRecord(raw);
    if (!record) continue;
    const key = record.email.toLocaleLowerCase("en-US");
    const current = unique.get(key);
    if (!current || (!current.createdAt && record.createdAt)) unique.set(key, record);
  }
  return [...unique.values()];
}

async function main() {
  const remote = process.argv.includes("--remote");
  const subscribers = await collectSubscribers();

  if (!remote) {
    console.log(
      `Dry run: ${subscribers.length} unique newsletter subscriber(s) are ready. No data was copied.`
    );
    console.log("Add --remote only after the Cloudflare D1 schema has been applied.");
    return;
  }

  if (subscribers.length === 0) {
    console.log("No newsletter subscribers to copy.");
    return;
  }

  const statements = subscribers.map(
    (subscriber) =>
      `INSERT OR IGNORE INTO newsletter_subscribers ` +
      `(prenom, nom, email, entreprise, secteur, active, created_at) VALUES (` +
      [
        sqlText(subscriber.prenom),
        sqlText(subscriber.nom),
        sqlText(subscriber.email),
        sqlText(subscriber.entreprise),
        sqlText(subscriber.secteur),
        String(subscriber.active),
        sqlText(subscriber.createdAt)
      ].join(", ") +
      ");"
  );

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "orionexa-d1-"));
  const sqlFile = path.join(tempDir, "newsletter-subscribers.sql");
  try {
    await writeFile(sqlFile, statements.join("\n"), { mode: 0o600 });
    await execFileAsync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "d1", "execute", databaseName, "--remote", `--file=${sqlFile}`],
      { cwd: projectRoot, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    console.log(
      `Copied ${subscribers.length} unique newsletter subscriber(s) to Cloudflare D1. The Replit source data was left unchanged.`
    );
  } catch {
    throw new Error(
      "Cloudflare import failed. Confirm Wrangler is authenticated, the D1 database exists, and its migrations are applied."
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
