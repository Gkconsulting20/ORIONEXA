# ORIONEXA-SALES — fondation V1

Agent commercial d'ORIONEXA, conçu pour aider à qualifier les prospects, prioriser les relances et suivre le pipeline commercial. Cette première brique est volontairement isolée : elle ne modifie pas les routes existantes du site et n'envoie aucun message automatiquement.

## Objectifs de la V1
- Normaliser et valider les informations professionnelles d'un prospect.
- Calculer un score explicable de priorité (0–100).
- Recommander une prochaine action commerciale.
- Persister les prospects dans PostgreSQL via des requêtes paramétrées.
- Préparer ultérieurement l'intégration à l'interface d'administration ORIONEXA.

## Champs et protection des données
Le module ne doit stocker que les données utiles à la relation commerciale. Le consentement ou la base légale applicable doit être vérifié avant toute prospection directe. Ne pas enregistrer de données sensibles, de mots de passe ou de données de paiement. Les accès aux fonctions de gestion doivent être réservés à l'administration authentifiée.

## Score V1 (explicable)
Le score est construit à partir du besoin exprimé, de la clarté du besoin, du budget indicatif et du consentement de contact. Il sert à ordonner les relances, pas à prendre une décision automatique définitive. Toute action sortante reste manuelle dans cette version.

## Utilisation
Le module exporte des fonctions pures dans `lead_engine.js` et des fonctions de persistance PostgreSQL qui reçoivent un pool en paramètre. Il n'est pas encore branché au serveur Express : cette intégration sera faite après revue des tests et des contrôles d'accès.

## Étapes suivantes
1. Tests unitaires et revue du score.
2. Routes API protégées par `requireAdmin`.
3. Tableau de bord de pipeline : Nouveau, Qualifié, Contacté, Rendez-vous, Proposition, Gagné, Perdu.
4. Brouillons d'emails personnalisés avec validation humaine obligatoire.
5. Intégration ultérieure à ORIONEXA-AI, sans envoi autonome avant configuration et autorisation explicites.
