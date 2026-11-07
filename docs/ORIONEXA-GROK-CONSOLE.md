# Console ORIONEXA-AI — connexion sécurisée

La console est publiée sur la route Cloudflare `/orionexa-ai`. Elle utilise la session administrateur existante et ne reçoit jamais la clé API Render dans le navigateur.

## Secrets à ajouter dans les variables du Worker Cloudflare

Ajouter les deux secrets suivants dans le Worker qui sert le dépôt `Gkconsulting20/ORIONEXA` :

- `ORION_GROK_API_URL` : `https://orionexa-ai.onrender.com`
- `ORION_GROK_API_KEY` : la valeur existante de `ORION_API_KEY` dans Render.

Ces valeurs sont des secrets côté Worker. Ne pas les placer dans un fichier HTML, JavaScript client, dépôt Git ou variable publique `VITE_*`.

Les variables d'administration déjà utilisées par le site doivent rester configurées :
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (au moins 32 caractères)

## Accès

Après déploiement du Worker :
- Console : `https://<domaine-orionexa>/orionexa-ai`
- Authentification : le mot de passe administrateur existant.
- La console appelle uniquement `/api/orion-grok/*` sur la même origine.
- Le Worker vérifie le cookie HttpOnly de session, puis ajoute le header Bearer côté serveur avant d'appeler Render.

## Routes proxifiées

- `GET /healthz`
- `POST /v1/run`
- `GET /v1/diagnostics/model`
- `GET /v1/memory`
- `POST /v1/memory`
- `POST /v1/sales/prospects/discover`
- `POST /v1/sales/public-search`
- `POST /v1/sales/campaigns/prepare`
- `/v1/tasks` et sous-routes autorisées

Le proxy applique une liste blanche de routes. Il ne relaie pas les chemins arbitraires.
