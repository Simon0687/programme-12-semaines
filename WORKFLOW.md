# Workflow CI/CD

## Flux de développement

### 1. Développement local (branche `dev`)

```bash
git clone <repo>
git checkout dev
npm install
npm run dev        # Écouter les changements, tester en local
```

Faire les modifs dans `src/App.jsx`, `src/main.jsx`, ou les configurations.

### 2. Pousser sur la branche `dev`

```bash
git add .
git commit -m "feat: ajout des abdos dans la séance du jour"
git push origin dev
```

GitHub Actions valide automatiquement : build, test. Si ✅, c'est prêt pour staging.

### 3. Préparation pre-prod : branche `staging`

Depuis GitHub (interface) ou en ligne de commande :

```bash
git checkout staging
git merge dev
git push origin staging
```

GitHub Actions déploie une preview sur Netlify : URL `staging-XXX--netlify-site-id.netlify.app` (accessible en 2–3 min).
Tester sur le téléphone via cette URL.

### 4. Merge en prod : branche `main`

Quand `staging` est validé :

```bash
git checkout main
git merge staging
git push origin main
```

**Automatiquement :**
- ✅ Build et tests
- 🚀 Déploiement Netlify production (URL fixe)
- 🔖 Tag Git créé (v1.0.0 → v1.0.1, etc.)
- 📈 Version bumped dans `package.json`, commit poussé

## Scenario : Modification du programme avec versioning

**Jour 1 — Simon fait une remarque dans le chat**

```
"Ajoute un exercice pour les abdos, et baisse le volume général de 20%"
```

**Jour 2 — Claude mets à jour l'app**

Modifications du fichier `src/App.jsx` (ou du JSON des exercices intégré), commit local.

**Jour 3 — Push sur GitHub `dev`**

```bash
git add src/App.jsx
git commit -m "feat: ajout ab wheel, volume −20%, bloc 2 ajusté (S8–S12)"
git push origin dev
```

GitHub Actions :
- ✅ Build OK (JS + CSS compilés)
- ✅ Tests OK
- Artifact créé et stocké

Lien de preview fourni (facultatif).

**Jour 4 — Staging**

```bash
git push origin staging:main  # ou merge via interface
```

Netlify déploie sur `staging-run-XXX--prog12.netlify.app`.
Simon teste sur son téléphone depuis l'app staging (1 min).

**Jour 5 — Prod**

```bash
git push origin main
```

Automatiquement :
- 🚀 Déploiement sur `prog12.netlify.app` (URL fixe)
- 🔖 Git tag : `v1.1.0` (version mineure : nouvelles fonctionnalités)
- 📝 package.json : `1.1.0` → `1.1.1` (prep pour la prochaine)
- 📋 GitHub Releases affiche les changements

Simon accède à l'app prod sur son téléphone, aucun changement de lien, tout est à jour.

## Branches et rôles

| Branche | Rôle | Déploiement | Accès |
|---------|------|------------|-------|
| **dev** | Développement courant | Artifact GitHub (optionnel) | Local seulement |
| **staging** | Pré-production, tests | Netlify staging (alias) | URL preview (partage facile) |
| **main** | Production | Netlify prod (fixe) | Endpoint public |

## Tagging et versioning

Format SemVer : `MAJOR.MINOR.PATCH`

- `v1.0.0` — Première version stable
- `v1.1.0` — Nouvelle fonctionnalité (delt lat prioritaire, abdos renforcés)
- `v1.0.1` — Bug fix (correction d'une formule de progression)
- `v2.0.0` — Changement majeur (restructuration UI, nouvel algorithme)

Tags automatiquement créés lors du merge sur `main`.

Historique visible : GitHub *Tags* ou *Releases*.

## Secrets GitHub à configurer

Sur GitHub, onglet *Settings → Secrets and variables → Actions*:

```
NETLIFY_AUTH_TOKEN           → Token personnel Netlify (créé sur app.netlify.com/user/settings/applications)
NETLIFY_SITE_ID_STAGING      → Site ID du site staging Netlify
NETLIFY_SITE_ID_PROD         → Site ID du site production Netlify
```

(Optionnel) Pour les notifications Slack, Discord, ajouter des tokens là aussi.

## Rollback

Si une version prod a un problème :

```bash
git revert <commit-hash>    # Crée un nouveau commit qui annule le changement
git push origin main
```

Ou forcer un retour à une version précédente :

```bash
git reset --hard v1.0.0     # Retour à v1.0.0
git push --force-with-lease origin main
```

GitHub Actions redéploie automatiquement, une nouvelle version est taggée.

## Monitoring et historique

- **GitHub** : Pull Requests, commits, tags, Actions runs
- **Netlify** : Logs de déploiement, analytics, rollback manuel possible
- **JSON du programme** : Export depuis l'app pour audit

## Exemple complet : 1 semaine

| Jour | Action | Commande / Lien |
|------|--------|-----------------|
| Lun | Simon teste la S4, fait une remarque | Commentaire dans le chat |
| Mar | Claude modifie `src/App.jsx` | Commit local |
| Mer | Push sur `dev` pour validation | `git push origin dev` |
| Jeu | Merge sur `staging` | `git push origin staging` |
| Jeu 17h | Simon teste sur `staging-run-XXX--` | URL Netlify preview |
| Ven | ✅ Validation, merge sur `main` | `git push origin main` |
| Ven 17h30 | 🚀 Live en prod, taggé `v1.1.0` | Netlify confirmation |
| Sam | Simon utilise la v1.1.0 en S5 | App mise à jour, même URL |

