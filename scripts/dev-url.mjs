/* =========================================================
   Les adresses du serveur de dev, écrites avant qu'il démarre

   Deux pièges, rencontrés le 2026-09-16, qui ont coûté une soirée de
   « le site ne répond pas » :

   1. `localhost` résout `::1` avant `127.0.0.1` sur cette machine. Tant
      que le serveur n'écoutait qu'en IPv4 (0.0.0.0), le navigateur
      tentait `[::1]:8000`, où rien n'écoutait, et rendait
      ERR_ADDRESS_UNREACHABLE — le message d'une adresse sans rien au
      bout, pas d'un serveur en panne. D'où `--serve=[::]:8000` dans le
      script `dev` : Go ouvre alors une socket double pile, IPv4 comprise.

   2. L'IP du PC sur le réseau est en DHCP : elle change d'une session à
      l'autre. Une adresse notée la veille donne exactement la même erreur,
      et c'est celle qu'on retape par réflexe. Elle s'affiche donc à chaque
      démarrage, plutôt que de se retenir.

   Les adresses en 169.254.x.x sont écartées : ce sont les interfaces sans
   bail DHCP (Bluetooth, adaptateurs virtuels), jamais celle du Wi-Fi.
   ========================================================= */

import os from "node:os";

const PORT = process.env.PORT || 8000;

const lan = Object.entries(os.networkInterfaces())
  .flatMap(([name, list]) => (list || []).map((n) => ({ ...n, name })))
  .filter((n) => n.family === "IPv4" && !n.internal && !n.address.startsWith("169.254."));

console.log("");
console.log(`  Sur ce PC     http://127.0.0.1:${PORT}/`);
for (const n of lan) console.log(`  Sur le réseau http://${n.address}:${PORT}/   (${n.name})`);
if (!lan.length) console.log("  Aucune adresse réseau : le PC n'est connecté à aucun Wi-Fi ni câble.");
console.log("");
