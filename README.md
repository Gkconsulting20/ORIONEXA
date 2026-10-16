# Orionexa Togo - Site Web Professionnel

Site web complet pour Orionexa, cabinet spécialisé en comptabilité et fiscalité en ligne, digitalisation, amélioration de processus et formation professionnelle au Togo.

## 🚀 Fonctionnalités

### Pages Principales
- **Accueil** : Hero section, statistiques, témoignages clients, aperçu des services et outils
- **Services** : Comptabilité digitalisée, Fiscalité, Optimisation des processus, Audit & Analyse
- **Formulaire de Devis** : Demande de devis personnalisée avec sélection de services
- **Prise de Rendez-vous** : Système de réservation en ligne (présentiel, visio, téléphone)
- **FAQ** : Questions fréquentes organisées par catégorie
- **Blog** : Articles avec filtres et contenu expandable
- **Calculateurs** : Outils de calcul fiscal (IS, TVA, salaire net, économies)
- **Dashboard Démo** : Tableau de bord interactif avec graphiques Chart.js

### Fonctionnalités Techniques
- ✅ Chatbot IA alimenté par OpenAI (via Replit AI Integrations)
- ✅ Progressive Web App (PWA) avec service worker
- ✅ Design responsive optimisé mobile
- ✅ Animations CSS et effets de scroll
- ✅ Widget de chat flottant sur toutes les pages
- ✅ Stockage JSON pour contacts, devis, rendez-vous
- ✅ Newsletter avec validation email
- ✅ Optimisation SEO (meta tags, descriptions)
- ✅ Intégration réseaux sociaux

## 📁 Structure du Projet

```
.
├── server.js              # Serveur Express principal
├── package.json           # Dépendances Node.js
├── views/                 # Pages HTML
│   ├── index.html        # Page d'accueil
│   ├── services.html     # Services
│   ├── contact.html      # Contact
│   ├── chatbot.html      # Chatbot
│   ├── abonnement.html   # Abonnements
│   ├── faq.html          # FAQ
│   ├── devis.html        # Formulaire de devis
│   ├── rendez-vous.html  # Prise de rendez-vous
│   ├── blog.html         # Blog
│   ├── calculateurs.html # Calculateurs fiscaux
│   └── dashboard.html    # Dashboard démo
├── public/
│   ├── css/
│   │   └── style.css     # Styles principaux
│   ├── js/
│   │   ├── script.js     # JavaScript principal
│   │   ├── animations.js # Animations
│   │   ├── calculateurs.js # Calculateurs
│   │   └── dashboard.js  # Dashboard
│   ├── manifest.json     # Manifest PWA
│   └── sw.js            # Service Worker
├── routes/
│   └── chatbot.js        # API chatbot OpenAI
└── data/                 # Données JSON (contacts, devis, etc.)
```

## 🛠️ Installation

```bash
# Installer les dépendances
npm install

# Démarrer le serveur
npm start
```

Le site sera accessible sur http://localhost:5000

## 🤖 Chatbot IA

Le chatbot utilise OpenAI via **Replit AI Integrations** :
- Pas besoin de clé API personnelle
- Facturation sur les crédits Replit
- Modèle : GPT-4o-mini
- Réponses spécialisées en comptabilité et fiscalité togolaise

## 📊 Calculateurs Intégrés

1. **Calculateur d'Impôts (IS)** : Estimation de l'impôt sur les sociétés
2. **Simulateur d'Économies** : Gains potentiels avec la digitalisation
3. **Calculateur TVA** : Calcul HT ↔ TTC
4. **Calculateur Salaire Net** : Conversion brut → net (Togo)

## 📱 Progressive Web App

- Installation possible sur mobile/desktop
- Fonctionne hors ligne (pages en cache)
- Icônes et thème personnalisés
- Expérience utilisateur native

## 🌐 API Endpoints

- `POST /api/contact` - Formulaire de contact
- `POST /api/devis` - Demande de devis
- `POST /api/rendez-vous` - Prise de rendez-vous
- `POST /api/newsletter` - Inscription newsletter
- `POST /api/chat` - Chatbot OpenAI

## 🚢 Déploiement

Le projet est configuré pour le déploiement **Replit Autoscale** :
- Mise à l'échelle automatique selon le trafic
- Optimisé pour les sites web stateless
- Commande de démarrage : `node server.js`

Pour publier le site, cliquez sur le bouton **Deploy** dans Replit.

## 🔒 Sécurité

- Variables d'environnement pour les secrets
- Validation des données côté serveur
- Headers Cache-Control configurés
- Pas de données sensibles dans le code

## 📝 Licence

© 2025 Orionexa Togo. Tous droits réservés.

---

**Développé avec ❤️ pour Orionexa Togo**

# Clean build (no wrangler.toml)
Deploy to Cloudflare Pages with Output dir 'public' and variables CF_ACCOUNT_ID/CF_API_TOKEN.
