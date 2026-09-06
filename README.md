# Programme 12 semaines

Entraînement périodisé Wendler 5/3/1 avec hypertrophie et cardio, suivi en temps réel sur le téléphone.

## Structure

- **src/** — Code source React
- **public/** — Assets statiques (index.html, icônes, service worker)
- **public/dist/** — Built JS et CSS (ignoré par Git, généré au déploiement)

## Branches

- **main** — Production (déploiement automatique sur Netlify)
- **staging** — Pre-prod (déploiement manuel)
- **dev** — Développement (tests, PR avant staging)

## Versioning

Format SemVer : `MAJOR.MINOR.PATCH` (cf. tags Git).

## Déploiement

1. Code poussé sur `dev` ou `staging`
2. GitHub Actions valide (lint, build)
3. PR mergée sur `main` → Netlify déploie auto
4. Version bumpée et taggée (v1.0.0, v1.0.1, etc.)

Pour un changement : commentaire → modifications Claude → push sur `dev` → validation sur Netlify preview → merge sur `main`.

## Développement local

```bash
npm install
npm run dev        # Watch mode, serveur sur http://localhost:8000
npm run build      # Build production
npm run test       # (placeholder)
```

## Données utilisateur

Le journal et les bilans sont stockés en localStorage du navigateur. 
Pas de serveur, pas de compte, pas de données envoyées.
Backup manuel : *Plan → Exporter le JSON*.

## License

MIT
