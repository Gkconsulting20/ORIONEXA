import { handleApiRequest, generateNewsletter, sendLatestNewsletter } from "./api.mjs";
import { handleOrionGrokProxy } from "./orion-grok-proxy.mjs";

const PAGE_ASSETS = new Map([
  ["/", "/views/index.html"],
  ["/services", "/views/services.html"],
  ["/contact", "/views/contact.html"],
  ["/chatbot", "/views/chatbot.html"],
  ["/abonnement", "/views/abonnement.html"],
  ["/faq", "/views/faq.html"],
  ["/devis", "/views/devis.html"],
  ["/newsletter", "/views/newsletter.html"],
  ["/calculateurs", "/views/calculateurs.html"],
  ["/rendez-vous", "/views/rendez-vous.html"],
  ["/dashboard", "/views/dashboard.html"],
  ["/applications", "/views/applications.html"],
  ["/presentation", "/views/presentation.html"],
  ["/prospectus", "/views/prospectus.html"],
  ["/applications/erp-gk", "/views/erp-gk.html"],
  ["/orionexa-ai", "/views/orionexa-ai.html"],
  ["/manifest.json", "/public/manifest.json"]
]);

function disableCaching(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/orion-grok/") || url.pathname === "/api/orion-grok") {
        return disableCaching(await handleOrionGrokProxy(request, env));
      }
      if (url.pathname.startsWith("/api/")) {
        return disableCaching(await handleApiRequest(request, env));
      }
      const pagePath = PAGE_ASSETS.get(url.pathname.replace(/\/+$/, "") || "/");
      const assetPath = pagePath || url.pathname;
      const assetUrl = new URL(assetPath, request.url);
      const assetRequest = new Request(assetUrl, { method: "GET", headers: request.headers });
      return disableCaching(await env.ASSETS.fetch(assetRequest));
    } catch (error) {
      console.error("Worker request failed:", error);
      return disableCaching(new Response(
        JSON.stringify({ success: false, message: "Une erreur est survenue." }),
        { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
      ));
    }
  },

  // Génération + ENVOI hebdomadaire automatique de la newsletter,
  // chaque vendredi à 07:00 UTC (07:00 à Lomé, sans décalage).
  // Génère le numéro, le stocke en base, puis l'envoie à tous les
  // abonnés actifs — sans relecture humaine (décision Cap, 20 nov. 2026).
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        // Garde anti-doublon : ne pas générer 2 numéros la même semaine
        // (par exemple si le déclencheur est rejoué après une erreur).
        const latest = await env.DB.prepare(
          "SELECT MAX(created_at) AS created_at FROM generated_newsletters"
        ).first();
        const last = latest?.created_at ? new Date(latest.created_at).getTime() : 0;
        if (Number.isFinite(last) && Date.now() - last < 6 * 86400000) {
          console.log("Newsletter hebdomadaire déjà générée récemment, génération ignorée.");
          return;
        }
        const request = new Request("https://orionexa.net/api/newsletters", { method: "GET" });
        const newsletter = await generateNewsletter(request, env);
        console.log("Newsletter hebdomadaire générée :", newsletter.issue, newsletter.subject);
        const sendResult = await sendLatestNewsletter(request, env);
        console.log("Newsletter hebdomadaire envoyée :", sendResult.sent, "envoyés,", sendResult.failed, "échecs.");
      } catch (error) {
        console.error("Échec de la newsletter hebdomadaire automatique :", error);
        throw error;
      }
    })());
  }
};
