# Configuration GitHub et Cloudflare Pages

## Étape 1 : Créer le repo sur GitHub

1. Aller sur https://github.com/new
2. Nommer le repo : `programme-12-semaines`
3. Description : "Suivi d'entraînement 12 semaines, Wendler 5/3/1 + hypertrophie"
4. Public ou Private (ton choix)
5. **Ne pas initialiser** README, .gitignore, license (on les a déjà)
6. Créer le repo

## Étape 2 : Pousser le code local sur GitHub

Sur ta machine locale, dans le dossier du repo cloné :

```bash
git remote add origin https://github.com/<TON_USERNAME>/programme-12-semaines.git
git branch -M main                           # Renommer master en main (optionnel)
git push -u origin main
git push -u origin staging
git push -u origin dev
```

Vérifier sur GitHub : tu devrais voir les trois branches et 3 commits.

## Étape 3 : Brancher Cloudflare Pages sur le dépôt

Un seul site à créer, pas deux : Cloudflare donne automatiquement une URL de preview
à chaque branche poussée, donc `staging` n'a pas besoin de son propre projet.

1. `dash.cloudflare.com` → menu de gauche **Workers & Pages**
2. **Create application** → onglet **Pages** → **Connect to Git**
3. **Install & Authorize** côté GitHub, en donnant accès à `programme-12-semaines`
4. Sélectionner le dépôt, puis **Begin setup** — c'est ce bouton qui ouvre l'écran
   « Set up builds and deployments », où vivent les seuls réglages qui comptent :

   | Champ | Valeur |
   |-------|--------|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm test && npm run build` |
   | Build output directory | `public` |

5. **Save and Deploy**

`public/dist/` est dans le `.gitignore` : c'est la *build command* qui produit le
bundle, ne la laisse pas vide. Et la suite de tests est devant le build dans cette
commande, volontairement — un déploiement ne part que si `npm test` passe.

Aucun secret GitHub n'est nécessaire : c'est Cloudflare qui lit le dépôt, pas un
workflow du dépôt qui pousse vers Cloudflare.

## Étape 4 : Tester le workflow

1. Faire un petit changement local sur `dev` :
   ```bash
   git checkout dev
   echo "# v1.0.0" >> CHANGELOG.md
   git add CHANGELOG.md && git commit -m "docs: init changelog" && git push origin dev
   ```

2. Aller sur le projet dans Cloudflare → onglet *Deployments* : un build doit être en cours.

3. Attendre que le build finisse (✅ = succès, ❌ = erreur). Les logs complets sont visibles en cliquant sur le déploiement.

4. Une fois `dev` validé, merger sur `staging` :
   ```bash
   git checkout staging && git merge dev && git push origin staging
   ```

5. Cloudflare construit une preview de `staging`. En 2–3 min, tu auras son URL.

6. Quand `staging` est OK, merger sur `main` :
   ```bash
   git push origin main
   ```

7. Cloudflare déploie automatiquement sur l'URL de production.

## Étape 5 : Configurer les branches protégées (optionnel)

Pour éviter les merges accidentels sur `main` :

1. GitHub → Settings → *Branches*
2. *Add rule* pour la branche `main`
3. Cocher *Require status checks to pass before merging* → Sélectionner le check publié par Cloudflare Pages
4. Sauvegarder

Maintenant, impossible de merger sur `main` si le build Cloudflare échoue.

## Étape 6 : Autoriser GitHub à pousser les tags

Pour que le workflow puisse créer des tags et les pousser automatiquement :

1. GitHub → Settings → *Developer settings → Personal access tokens*
2. *Tokens (classic)* → *Generate new token*
3. Permissions : `repo`, `write:packages`
4. Copier le token
5. Sur GitHub → Secrets → Ajouter `GH_TOKEN` avec cette valeur
6. Modifier `.github/workflows/ci-cd.yml` pour utiliser ce token lors du tag push

## Vérification finale

```bash
# Depuis ta machine locale
git branch -a                    # Voir toutes les branches
git remote -v                    # Voir les remotes
git log --oneline -10            # Voir les commits
```

Tout doit pointer vers https://github.com/<TON_USERNAME>/programme-12-semaines.git

