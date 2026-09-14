# Programme 12 semaines

Entraînement périodisé Wendler 5/3/1 avec hypertrophie et cardio, suivi en temps réel sur le téléphone.

## Structure

- **src/** — Code source React
- **public/** — Assets statiques (index.html, icônes, service worker)
- **public/dist/** — Built JS et CSS (ignoré par Git, généré au déploiement)

## Branches

- **main** — Production, build et déploiement automatiques sur Cloudflare (<https://programme-12-semaines.simongillet.workers.dev>)
- **staging** — Pre-prod (déploiement manuel)
- **dev** — Développement (tests, PR avant staging)

## Versioning

Format SemVer : `MAJOR.MINOR.PATCH` (cf. tags Git).

## Déploiement

Cloudflare construit le site directement depuis GitHub (un Worker servant des
assets statiques, branché sur le dépôt). Il n'y a pas de
workflow de déploiement à maintenir dans le dépôt.

1. Push sur n'importe quelle branche → build `npm test && npm run build`
2. La suite de tests garde le déploiement : si `npm test` échoue, rien n'est publié
3. `main` → l'URL de production ; toute autre branche → une URL de preview propre
   à cette version, listée à côté du build dans le tableau de bord
4. Version bumpée et taggée à la main (`npm run release`)

Pour un changement : commentaire → modifications Claude → push sur `dev` → validation sur l'URL de preview → merge sur `main`.

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
