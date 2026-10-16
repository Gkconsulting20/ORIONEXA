import { CHAT_SYSTEM_PROMPT, NEWSLETTER_SYSTEM_PROMPT } from "./prompts.mjs";

const AI_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const SESSION_COOKIE = "orionexa_admin";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

const protectedRoutes = new Set([
  "POST /api/newsletters/generate",
  "POST /api/newsletters/send",
  "GET /api/newsletters/test-email"
]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function requireDatabase(env) {
  if (!env.DB) throw new Error("Cloudflare D1 binding DB is missing.");
  return env.DB;
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function isEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function sessionKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createSession(secret) {
  const payload = toBase64Url(
    encoder.encode(
      JSON.stringify({ exp: Date.now() + SESSION_LIFETIME_SECONDS * 1000 })
    )
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await sessionKey(secret),
    encoder.encode(payload)
  );
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function isAuthenticated(request, secret) {
  if (!secret) return false;
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return false;

  const token = cookie.slice(SESSION_COOKIE.length + 1);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await sessionKey(secret),
      fromBase64Url(signature),
      encoder.encode(payload)
    );
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch {
    return false;
  }
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

async function adminLogin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    return json(
      {
        success: false,
        message: "Les secrets admin Cloudflare ne sont pas configurés."
      },
      503
    );
  }

  const body = await readJson(request);
  if (typeof body?.password !== "string") {
    return json({ success: false, message: "Mot de passe incorrect" }, 400);
  }

  const [expected, supplied] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_PASSWORD)),
    crypto.subtle.digest("SHA-256", encoder.encode(body.password))
  ]);
  const expectedBytes = new Uint8Array(expected);
  const suppliedBytes = new Uint8Array(supplied);
  let difference = 0;
  for (let i = 0; i < expectedBytes.length; i += 1) {
    difference |= expectedBytes[i] ^ suppliedBytes[i];
  }

  if (difference !== 0) {
    return json({ success: false, message: "Mot de passe incorrect" }, 401);
  }

  const token = await createSession(env.SESSION_SECRET);
  return json(
    { success: true },
    200,
    {
      "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME_SECONDS}`
    }
  );
}

async function fetchAsset(request, env, path) {
  const url = new URL(path, request.url);
  return env.ASSETS.fetch(new Request(url, { method: "GET" }));
}

async function getStaticNewsletterIndex(request, env) {
  const response = await fetchAsset(request, env, "/data/newsletters/index.json");
  if (!response.ok) return [];
  const index = await response.json();
  return Array.isArray(index) ? index : [];
}

function fromDatabaseNewsletter(row) {
  return {
    issue: row.issue,
    subject: row.subject,
    date: row.date,
    createdAt: row.created_at,
    filePath: `newsletter-${row.issue}.html`,
    status: row.status,
    sentCount: row.sent_count
  };
}

async function listNewsletters(request, env) {
  const db = requireDatabase(env);
  const [staticIndex, generatedResult] = await Promise.all([
    getStaticNewsletterIndex(request, env),
    db
      .prepare(
        "SELECT issue, subject, date, created_at, status, sent_count FROM generated_newsletters"
      )
      .all()
  ]);

  const newsletters = [
    ...staticIndex,
    ...(generatedResult.results || []).map(fromDatabaseNewsletter)
  ].sort((left, right) => Number(right.issue) - Number(left.issue));

  return json({ success: true, newsletters });
}

async function getNewsletter(request, env, issue) {
  if (!/^\d{1,6}$/.test(issue)) return null;
  const db = requireDatabase(env);
  const row = await db
    .prepare("SELECT html_content FROM generated_newsletters WHERE issue = ?")
    .bind(Number(issue))
    .first();

  if (row?.html_content) {
    return new Response(row.html_content, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const assetResponse = await fetchAsset(
    request,
    env,
    `/data/newsletters/newsletter-${issue}.html`
  );
  return assetResponse.ok ? assetResponse : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanGeneratedHtml(value) {
  return String(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<(iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/javascript\s*:/gi, "");
}

async function fetchRecentNews(apiKey) {
  if (!apiKey) {
    throw new Error(
      "La clé SERPER_API_KEY doit être configurée pour générer une newsletter fondée sur des actualités récentes."
    );
  }

  const queries = [
    "Togo économie actualité",
    "CEDEAO commerce Afrique Ouest",
    "fiscalité entreprise Togo"
  ];
  const articles = [];

  for (const query of queries) {
    const response = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, gl: "tg", hl: "fr", num: 10 })
    });
    if (!response.ok) {
      throw new Error(`La recherche d’actualités a échoué (${response.status}).`);
    }
    const result = await response.json();
    articles.push(...(Array.isArray(result.news) ? result.news : []));
  }

  const seen = new Set();
  return articles
    .filter((article) => {
      const title = String(article.title || "").trim();
      if (!title || seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .slice(0, 15);
}

function newsletterDate(date = new Date()) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Africa/Lome"
  }).format(date);
}

function weekNumber(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function newsletterHtml(issue, content, date) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Newsletter Orionexa N°${issue}</title>
  <style>
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;line-height:1.6;color:#333;max-width:700px;margin:0 auto;padding:20px}
    .header{background:linear-gradient(135deg,#1a252f 0%,#2c3e50 100%);color:#fff;padding:30px;text-align:center;border-radius:10px 10px 0 0}
    .header h1{margin:0;font-size:28px}.header .issue{color:#3498db;font-size:16px;margin-top:10px}
    .header .date{color:#bdc3c7;font-size:14px;margin-top:5px}.content{background:#fff;padding:30px;border:1px solid #e8e8e8}
    h2{color:#2c3e50;border-bottom:2px solid #3498db;padding-bottom:10px;margin-top:25px}h3{color:#3498db}
    ul{padding-left:20px}li{margin-bottom:10px}.footer{background:#f8f9fa;padding:20px;text-align:center;border-radius:0 0 10px 10px;font-size:14px;color:#666}
  </style>
</head>
<body>
  <div class="header"><h1>Newsletter Orionexa</h1><div class="issue">N°${issue} - Actualité Économique Hebdomadaire</div><div class="date">${escapeHtml(date)}</div></div>
  <div class="content">${cleanGeneratedHtml(content)}</div>
  <div class="footer"><p><strong>Orionexa</strong> - La gestion moderne, sans limites.</p><p>Comptabilité • Fiscalité • Digitalisation • Formation</p><p><a href="https://orionexa.com">www.orionexa.com</a> | contact@orionexa.com</p><p style="font-size:12px;color:#999">Pour vous désinscrire, contactez contact@orionexa.com</p></div>
</body>
</html>`;
}

async function generateNewsletter(request, env) {
  const db = requireDatabase(env);
  if (!env.AI) throw new Error("Le binding Workers AI n’est pas configuré.");

  const [staticIndex, latestRow] = await Promise.all([
    getStaticNewsletterIndex(request, env),
    db.prepare("SELECT MAX(issue) AS issue FROM generated_newsletters").first()
  ]);
  const highestStaticIssue = staticIndex.reduce(
    (max, item) => Math.max(max, Number(item.issue) || 0),
    0
  );
  const issue = Math.max(highestStaticIssue, Number(latestRow?.issue) || 0) + 1;
  const now = new Date();
  const date = newsletterDate(now);
  const year = now.getFullYear();
  const news = await fetchRecentNews(env.SERPER_API_KEY);
  const newsContext = news
    .map(
      (item, index) =>
        `${index + 1}. ${item.title}\n   Source: ${item.source || "Source non précisée"}\n   Date: ${item.date || "Récente"}\n   Résumé: ${item.snippet || ""}`
    )
    .join("\n\n");

  const prompt = `Génère la Newsletter Orionexa N°${issue} pour la semaine ${weekNumber(now)} de ${year}.

ACTUALITÉS RÉCENTES (utilise uniquement ces informations, n'invente aucun chiffre ni fait) :
${newsContext}

Rédige en HTML avec h2, h3, p, ul, li et strong :
1. Éditorial (2-3 phrases)
2. Actualités économiques du Togo (3-4 points, sources si pertinentes)
3. Actualités de la CEDEAO (2-3 points si les sources le permettent)
4. Focus fiscal et comptable (rappels et conseils sans inventer d'échéance)
5. Conseil pratique de la semaine
6. Chiffre clé uniquement si une statistique vérifiable apparaît dans les sources.

Ton professionnel et accessible. N'inclus pas de document HTML complet ni de balises script.`;
  const result = await env.AI.run(AI_MODEL, {
    messages: [
      { role: "system", content: NEWSLETTER_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    max_tokens: 2500,
    temperature: 0.7
  });
  const rawContent =
    typeof result === "string" ? result : result?.response || result?.result;
  if (!rawContent) throw new Error("Workers AI n’a pas retourné de contenu.");

  const content = String(rawContent)
    .replace(/```html\n?/gi, "")
    .replace(/```\n?/g, "")
    .replace(/<!DOCTYPE html>[\s\S]*?<body>/gi, "")
    .replace(/<\/body>[\s\S]*?<\/html>/gi, "")
    .trim();
  const subject = `Newsletter Orionexa N°${issue} - Actualité Économique`;
  const createdAt = now.toISOString();
  const html = newsletterHtml(issue, content, date);

  await db
    .prepare(
      `INSERT INTO generated_newsletters
        (issue, subject, date, created_at, status, sent_count, html_content)
       VALUES (?, ?, ?, ?, 'generated', 0, ?)`
    )
    .bind(issue, subject, date, createdAt, html)
    .run();

  return {
    issue,
    subject,
    date,
    createdAt,
    filePath: `newsletter-${issue}.html`,
    status: "generated",
    sentCount: 0
  };
}

async function getNewsletterForSending(request, env) {
  const db = requireDatabase(env);
  const [staticIndex, generatedResult] = await Promise.all([
    getStaticNewsletterIndex(request, env),
    db
      .prepare(
        "SELECT issue, subject, date, created_at, status, sent_count FROM generated_newsletters"
      )
      .all()
  ]);
  const newsletters = [
    ...staticIndex,
    ...(generatedResult.results || []).map(fromDatabaseNewsletter)
  ].sort((left, right) => Number(right.issue) - Number(left.issue));

  let newsletter = newsletters[0];
  if (!newsletter) return null;

  const created = new Date(newsletter.createdAt || newsletter.created_at || 0);
  if (!Number.isFinite(created.getTime()) || Date.now() - created.getTime() > 7 * 86400000) {
    newsletter = await generateNewsletter(request, env);
  }

  const detail = await getNewsletter(request, env, String(newsletter.issue));
  return detail
    ? { newsletter, html: await detail.text() }
    : null;
}

async function sendNewsletterEmail(apiKey, subscriber, newsletter, htmlContent) {
  const greeting = subscriber.prenom || "Cher abonné";
  const personalizedHtml = htmlContent.replace(
    '<div class="content">',
    `<div class="content"><p style="margin-bottom:20px;color:#666">Bonjour <strong>${escapeHtml(greeting)}</strong>,</p>`
  );
  const name = [subscriber.prenom, subscriber.nom].filter(Boolean).join(" ");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      sender: { name: "Orionexa", email: "gkconsulting20@gmail.com" },
      to: [{ email: subscriber.email, name }],
      replyTo: { email: "contact@orionexa.com", name: "Orionexa" },
      subject: newsletter.subject,
      htmlContent: personalizedHtml
    })
  });
  return response.ok;
}

async function sendLatestNewsletter(request, env) {
  if (!env.BREVO_API_KEY) {
    throw new Error("La clé BREVO_API_KEY doit être configurée dans Cloudflare.");
  }
  const db = requireDatabase(env);
  const delivery = await getNewsletterForSending(request, env);
  if (!delivery) throw new Error("Aucune newsletter disponible.");

  const result = await db
    .prepare(
      "SELECT prenom, nom, email FROM newsletter_subscribers WHERE active = 1 ORDER BY id"
    )
    .all();
  const subscribers = result.results || [];
  if (subscribers.length === 0) {
    return {
      success: true,
      sent: 0,
      sentCount: 0,
      failed: 0,
      message: "Aucun abonné actif."
    };
  }

  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    try {
      if (
        await sendNewsletterEmail(
          env.BREVO_API_KEY,
          subscriber,
          delivery.newsletter,
          delivery.html
        )
      ) {
        sent += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  const generated = await db
    .prepare("SELECT issue FROM generated_newsletters WHERE issue = ?")
    .bind(Number(delivery.newsletter.issue))
    .first();
  if (generated && sent > 0) {
    await db
      .prepare(
        "UPDATE generated_newsletters SET status = 'sent', sent_count = ?, sent_at = ? WHERE issue = ?"
      )
      .bind(sent, new Date().toISOString(), Number(delivery.newsletter.issue))
      .run();
  }

  return {
    success: sent > 0 || failed === 0,
    newsletter: delivery.newsletter,
    sent,
    sentCount: sent,
    failed
  };
}

async function testEmailConnection(env) {
  if (!env.BREVO_API_KEY) {
    return json(
      { success: false, message: "BREVO_API_KEY n’est pas configurée dans Cloudflare." },
      503
    );
  }
  const response = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": env.BREVO_API_KEY, Accept: "application/json" }
  });
  if (!response.ok) {
    return json({ success: false, message: `Connexion Brevo refusée (${response.status}).` });
  }
  const account = await response.json();
  return json({ success: true, message: `Connected as: ${account.email || "Brevo"}` });
}

async function askCloudflareAI(env, messages, maxTokens) {
  if (!env.AI) throw new Error("Le binding Workers AI n’est pas configuré.");
  const result = await env.AI.run(AI_MODEL, {
    messages,
    max_tokens: maxTokens,
    temperature: 0.7
  });
  const answer = typeof result === "string" ? result : result?.response || result?.result;
  if (typeof answer !== "string" || !answer.trim()) {
    throw new Error("Workers AI n’a pas retourné de réponse.");
  }
  return answer.trim();
}

export async function handleApiRequest(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method.toUpperCase();
  const routeKey = `${method} ${pathname}`;

  if (routeKey === "POST /api/admin/login") return adminLogin(request, env);
  if (routeKey === "POST /api/admin/logout") {
    return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (
    protectedRoutes.has(routeKey) &&
    !(await isAuthenticated(request, env.SESSION_SECRET))
  ) {
    return json({ success: false, message: "Authentification admin requise." }, 401);
  }

  try {
    if (routeKey === "POST /api/contact") {
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      if (
        !body ||
        typeof body.name !== "string" ||
        !isEmail(email) ||
        typeof body.message !== "string" ||
        !body.message.trim() ||
        body.message.length > 20000
      ) {
        return json({ success: false, message: "Veuillez vérifier les champs du formulaire." }, 400);
      }
      await requireDatabase(env)
        .prepare(
          "INSERT INTO contact_requests (name, email, message, created_at) VALUES (?, ?, ?, ?)"
        )
        .bind(body.name.trim(), email, body.message.trim(), new Date().toISOString())
        .run();
      return json({ success: true, message: "Message reçu avec succès !" });
    }

    if (routeKey === "POST /api/newsletter") {
      const body = await readJson(request);
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      if (!body || !isEmail(email)) {
        return json({ success: false, message: "Veuillez saisir une adresse courriel valide." }, 400);
      }
      const result = await requireDatabase(env)
        .prepare(
          `INSERT OR IGNORE INTO newsletter_subscribers
            (prenom, nom, email, entreprise, secteur, active)
           VALUES (?, ?, ?, ?, ?, 1)`
        )
        .bind(
          typeof body.prenom === "string" ? body.prenom.trim() : null,
          typeof body.nom === "string" ? body.nom.trim() : null,
          email,
          typeof body.entreprise === "string" ? body.entreprise.trim() : null,
          typeof body.secteur === "string" ? body.secteur.trim() : null
        )
        .run();
      if (!result.meta?.changes) {
        return json({
          success: false,
          message: "Cet email est déjà inscrit à notre newsletter."
        });
      }
      return json({
        success: true,
        message: "Merci ! Vous êtes maintenant inscrit à notre newsletter hebdomadaire."
      });
    }

    if (routeKey === "POST /api/devis" || routeKey === "POST /api/rendez-vous") {
      const body = await readJson(request);
      if (!body || JSON.stringify(body).length > 20000) {
        return json({ success: false, message: "Les informations envoyées sont invalides." }, 400);
      }
      const createdAt = new Date().toISOString();
      if (routeKey === "POST /api/devis") {
        await requireDatabase(env)
          .prepare("INSERT INTO quote_requests (payload_json, created_at) VALUES (?, ?)")
          .bind(JSON.stringify(body), createdAt)
          .run();
        return json({
          success: true,
          message: "Demande de devis reçue ! Nous vous contacterons sous 24h."
        });
      }
      await requireDatabase(env)
        .prepare("INSERT INTO appointments (payload_json, created_at) VALUES (?, ?)")
        .bind(JSON.stringify(body), createdAt)
        .run();
      return json({
        success: true,
        message: "Rendez-vous enregistré ! Nous vous confirmerons par email."
      });
    }

    if (routeKey === "GET /api/newsletters") return listNewsletters(request, env);
    if (routeKey === "GET /api/newsletter-subscribers/count") {
      const count = await requireDatabase(env)
        .prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE active = 1")
        .first();
      return json({ count: Number(count?.count || 0) });
    }

    const newsletterIssue = pathname.match(/^\/api\/newsletters\/(\d+)$/);
    if (method === "GET" && newsletterIssue) {
      const response = await getNewsletter(request, env, newsletterIssue[1]);
      return response || json({ error: "Newsletter not found" }, 404);
    }

    if (routeKey === "POST /api/newsletters/generate") {
      const newsletter = await generateNewsletter(request, env);
      return json({ success: true, newsletter });
    }
    if (routeKey === "POST /api/newsletters/send") {
      const result = await sendLatestNewsletter(request, env);
      return json(result, result.success ? 200 : 502);
    }
    if (routeKey === "GET /api/newsletters/test-email") {
      return await testEmailConnection(env);
    }

    if (routeKey === "POST /api/chat") {
      const body = await readJson(request);
      if (typeof body?.message !== "string" || !body.message.trim()) {
        return json({ error: "Message is required" }, 400);
      }
      const response = await askCloudflareAI(
        env,
        [
          { role: "system", content: CHAT_SYSTEM_PROMPT },
          { role: "user", content: body.message.slice(0, 8000) }
        ],
        300
      );
      return json({ response });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    console.error("Cloudflare API request failed:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Une erreur est survenue. Veuillez réessayer.";
    return json({ success: false, message }, 500);
  }
}
