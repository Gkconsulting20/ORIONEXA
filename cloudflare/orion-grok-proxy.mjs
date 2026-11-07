const COOKIE_NAME = "orionexa_admin";
const encoder = new TextEncoder();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function validAdminSession(request, secret) {
  if (!secret || secret.length < 32) return false;
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE_NAME + "="));
  if (!cookie) return false;
  const token = cookie.slice(COOKIE_NAME.length + 1);
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC", key, fromBase64Url(signature), encoder.encode(payload)
    );
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch {
    return false;
  }
}

function allowedBackendPath(path) {
  return path === "/healthz" ||
    path === "/v1/run" ||
    path === "/v1/diagnostics/model" ||
    path === "/v1/memory" ||
    path === "/v1/sales/prospects/discover" ||
    path === "/v1/sales/public-search" ||
    path === "/v1/sales/campaigns/prepare" ||
    /^\/v1\/tasks(?:\/[A-Za-z0-9_-]+(?:\/(?:run|pause|stop|resume))?)?$/.test(path);
}

export async function handleOrionGrokProxy(request, env) {
  if (!(await validAdminSession(request, env.SESSION_SECRET))) {
    return json({ success: false, message: "Authentification admin requise." }, 401);
  }
  const url = new URL(request.url);
  const backendPath = url.pathname.slice("/api/orion-grok".length) || "/";
  if (!allowedBackendPath(backendPath)) {
    return json({ success: false, message: "Route backend non autorisée." }, 404);
  }
  const base = String(env.ORION_GROK_API_URL || "").replace(/\/+$/, "");
  const apiKey = String(env.ORION_GROK_API_KEY || "");
  if (!base || apiKey.length < 32) {
    return json({
      success: false,
      message: "Le proxy ORIONEXA-GROK doit être configuré dans les secrets Cloudflare."
    }, 503);
  }
  const target = new URL(base + backendPath + url.search);
  const headers = new Headers();
  headers.set("Authorization", "Bearer " + apiKey);
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  try {
    const upstream = await fetch(target, init);
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders
    });
  } catch {
    return json({ success: false, message: "Backend Render momentanément inaccessible." }, 502);
  }
}
