# Configuration GitHub et Netlify

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

## Étape 3 : Générer les tokens Netlify

1. Aller sur https://app.netlify.com/user/settings/applications
2. *New access token* → Nommer "GitHub Actions CI/CD" → Copier le token

## Étape 4 : Créer les sites Netlify

### Site de staging

1. https://app.netlify.com → *Add new site → Deploy manually*
2. Pousser le dossier `public` du repo → Netlify te donne un site ID (ex: `abc123def456`)
3. Settings → *Site details → Site name* → Renommer en `prog12-staging` ou similaire
4. Noter le **Site ID** et l'URL (`prog12-staging.netlify.app`)

### Site de production

Même chose : créer un deuxième site, le nommer `prog12` ou `programme-12-semaines`.
Noter le **Site ID** et l'URL (fixe).

## Étape 5 : Ajouter les secrets GitHub

Sur GitHub, onglet *Settings → Secrets and variables → Actions*, cliquer *New repository secret* pour chacun :

| Nom | Valeur |
|-----|--------|
| `NETLIFY_AUTH_TOKEN` | Token généré à l'étape 3 |
| `NETLIFY_SITE_ID_STAGING` | Site ID de staging (ex: `abc123def456`) |
| `NETLIFY_SITE_ID_PROD` | Site ID de production |

**Important :** Les valeurs des secrets sont masquées, même pour toi après l'ajout (c'est normal).

## Étape 6 : Tester le workflow

1. Faire un petit changement local sur `dev` :
   ```bash
   git checkout dev
   echo "# v1.0.0" >> CHANGELOG.md
   git add CHANGELOG.md && git commit -m "docs: init changelog" && git push origin dev
   ```

2. Aller sur GitHub → onglet *Actions* : tu devrais voir un workflow run en cours.

3. Attendre que le build finisse (✅ = succès, ❌ = erreur). Les logs sont visibles en cliquant sur le run.

4. Une fois `dev` validé, merger sur `staging` :
   ```bash
   git checkout staging && git merge dev && git push origin staging
   ```

5. Actions lance un "Deploy preview" sur Netlify. En 2–3 min, tu auras une URL preview.

6. Quand `staging` est OK, merger sur `main` :
   ```bash
   git push origin main
   ```

7. Netlify déploie automatiquement sur la prod, GitHub crée un tag `v1.0.0`.

## Étape 7 : Configurer les branches protégées (optionnel)

Pour éviter les merges accidentels sur `main` :

1. GitHub → Settings → *Branches*
2. *Add rule* pour la branche `main`
3. Cocher *Require status checks to pass before merging* → Sélectionner "build"
4. Sauvegarder

Maintenant, impossible de merger sur `main` si le build GitHub Actions échoue.

## Étape 8 : Autoriser GitHub à pousser les tags

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

