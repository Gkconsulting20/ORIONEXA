import { handleApiRequest } from "./api.mjs";

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
      if (url.pathname.startsWith("/api/")) {
        return disableCaching(await handleApiRequest(request, env));
      }

      const pagePath = PAGE_ASSETS.get(url.pathname.replace(/\/+$/, "") || "/");
      const assetPath = pagePath || url.pathname;
      const assetUrl = new URL(assetPath, request.url);
      const assetRequest = new Request(assetUrl, {
        method: "GET",
        headers: request.headers
      });
      return disableCaching(await env.ASSETS.fetch(assetRequest));
    } catch (error) {
      console.error("Worker request failed:", error);
      return disableCaching(
        new Response(
          JSON.stringify({ success: false, message: "Une erreur est survenue." }),
          {
            status: 500,
            headers: { "Content-Type": "application/json; charset=utf-8" }
          }
        )
      );
    }
  }
};
