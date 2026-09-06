# Premier déploiement : checklist

## Avant de commencer

- [ ] Compte GitHub créé
- [ ] Compte Netlify créé (lié optionnellement à GitHub)
- [ ] Dossier `programme-12s-repo` cloné localement

## GitHub

- [ ] Créer le repo `programme-12-semaines` sur GitHub
- [ ] Pousser les 3 branches (main, staging, dev)
- [ ] Vérifier que 3 commits et 3 branches apparaissent sur GitHub

## Netlify

- [ ] Créer site **staging** : `prog12-staging.netlify.app`
- [ ] Créer site **production** : `prog12.netlify.app` (ou similaire)
- [ ] Noter les deux Site IDs

## GitHub Secrets

- [ ] Ajouter `NETLIFY_AUTH_TOKEN`
- [ ] Ajouter `NETLIFY_SITE_ID_STAGING`
- [ ] Ajouter `NETLIFY_SITE_ID_PROD`

## Test du workflow

- [ ] Pousser une modif sur `dev`, voir le build en Actions
- [ ] Merger `dev` → `staging`, voir le preview Netlify
- [ ] Merger `staging` → `main`, voir le déploiement prod

## Après la première prod

- [ ] Accéder à `prog12.netlify.app` et tester l'app
- [ ] Installer sur le téléphone (PWA)
- [ ] Vérifier le localStorage (saisir une rép, vérifier que c'est sauvegardé)
- [ ] Exporter un JSON depuis l'app, vérifier que c'est correct

## Prêt pour la S1 (lundi 7 sep)

- [ ] App en prod et accessible
- [ ] Données sauvegardées en local
- [ ] GitHub Actions validant les changements

