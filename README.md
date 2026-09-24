# Programme 12 semaines

Entraînement périodisé Wendler 5/3/1 avec hypertrophie et cardio, suivi en temps réel sur le téléphone.

## Commencer

Ouvrir <https://programme-12-semaines.simongillet.workers.dev> sur son téléphone,
l'installer depuis le menu du navigateur, et répondre aux cinq questions :
**jours, durée, matériel, niveau, objectif**. L'appli compose le programme,
l'éditeur permet de le retoucher, et il n'y a plus qu'à s'entraîner.

Rien à télécharger, rien à demander à personne, aucun compte. L'appli porte le
catalogue d'exercices, le format de programme, le moteur qui compose et le
validateur qui juge : **installer l'appli, c'est tout avoir** (#19 Q4). Il n'y a
pas de « pack » à distribuer à côté, et il n'y en aura pas — la génération vit
dans l'appli depuis le 2026-09-15.

Pour ne pas partir de zéro, on peut aussi composer son programme séance par
séance, ou charger un fichier au format de l'appli. Les trois routes mènent au
même endroit.

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
