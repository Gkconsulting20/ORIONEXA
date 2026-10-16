# Orionexa sur Cloudflare

Cette configuration prépare le site pour Cloudflare Workers, Cloudflare D1 et Workers AI. Elle ne publie rien automatiquement.

## Contenu transféré

- Les pages, fichiers publics et 4 newsletters existantes sont servis depuis les assets du Worker.
- Les inscriptions newsletter de PostgreSQL et de `data/newsletter-subscribers.json` peuvent être réunies dans D1. Le script déduplique par adresse courriel et ne supprime rien de la source.
- Les nouveaux formulaires contact, devis et rendez-vous seront conservés dans D1.
- La base de production Replit ne montrait aucune table lors de la vérification. Le script importe les lignes de la base de développement et le fichier local; il ne copie pas de données de production invisibles.

## Préparation du compte Cloudflare

1. Authentifier Wrangler avec `npx wrangler login`.
2. Créer la base avec `npx wrangler d1 create orionexa-data`, puis remplacer le `database_id` provisoire dans `wrangler.jsonc` par l’identifiant retourné.
3. Appliquer le schéma avec `npx wrangler d1 migrations apply orionexa-data --remote`.
4. Ajouter les secrets Cloudflare avec `npx wrangler secret put ADMIN_PASSWORD`, `npx wrangler secret put SESSION_SECRET` et `npx wrangler secret put BREVO_API_KEY`. Wrangler demande chaque valeur sans l’afficher dans le code. `SESSION_SECRET` doit contenir au moins 32 caractères aléatoires.
5. Pour générer des newsletters fondées sur des nouvelles récentes, ajouter aussi `SERPER_API_KEY`. Sans cette clé, la génération échoue clairement au lieu d’inventer des actualités.
6. Les réponses du chatbot et la génération de newsletter utilisent `@cf/qwen/qwen3-30b-a3b-fp8` via le binding Workers AI `AI`. Qwen3-30B-A3B est sous licence Apache 2.0 et active environ 3,3 milliards de paramètres par réponse; aucune clé OpenAI de Replit n’est réutilisée.

Workers AI est appelé uniquement lorsqu’une requête utilise le chatbot ou génère une newsletter. Vérifier les tarifs Cloudflare du compte avant d’activer ces fonctions.

## Vérifications et migration des abonnés

- `npm run build:cloudflare` prépare les assets statiques.
- `npm run dev:cloudflare` démarre l’environnement local Wrangler. Les appels IA peuvent entraîner des frais même en développement local; ne pas tester les routes IA sans vérifier les tarifs.
- `npm run migrate:cloudflare:data` affiche seulement le nombre de lignes dédupliquées et ne copie rien.
- Après avoir créé D1 et appliqué son schéma, `npm run migrate:cloudflare:data -- --remote` copie les abonnés depuis la base source et le fichier local vers D1. Le fichier SQL temporaire contenant ces données est supprimé après l’opération.

Le dépôt Replit doit rester disponible jusqu’à ce que le Worker Cloudflare et les données migrées aient été vérifiés. Cette configuration seule n’est pas une preuve que le site est déjà en ligne sur Cloudflare.
