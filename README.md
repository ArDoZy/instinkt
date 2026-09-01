# Instynkt

Jeu de stratégie tour par tour, 2 joueurs en hot-seat, en JavaScript vanilla
(modules ES6, aucune dépendance, aucun build step).

Particularité : **on ne déplace jamais ses créatures**. Chacune obéit à un
instinct — un algorithme simple et prévisible. Le joueur agit indirectement :
il invoque, modifie les instincts, transforme le terrain, buffe et débuffe.

## Lancer

```sh
npm run dev       # sert la racine sur http://localhost:8000 (alias : npm run serve)
npm test          # tests du moteur (node, sans dépendance)
npm run stats     # statistiques de génération de plateau
```

Le jeu se joue dans le navigateur, **via un serveur local** : ouvrir `index.html`
en `file://` ne marche pas, le navigateur bloque les modules ES6.

Dans un Codespace ou un conteneur, `npm run dev` écoute sur `0.0.0.0:8000` ;
GitHub propose alors le port 8000 dans l'onglet **Ports**, il suffit d'ouvrir
l'URL transférée. Aucune installation n'est nécessaire (pas de `node_modules`,
le serveur est celui de Python).

## Architecture

```
js/engine/     moteur pur, déterministe, zéro accès au DOM
  prng.js        PRNG mulberry32 seedé, état sérialisable
  constants.js   BALANCE, biomes, instincts, les 16 cartes
  geometry.js    grille 8×8, distance de Chebyshev, voisinages
  board.js       génération par croissance de graines, régions de biome
  state.js       structure du state, sérialisation, lecture
  textview.js    rendu texte du plateau (mise au point)
js/ui/         couche vue : seule à toucher le DOM
css/           jetons de design puis feuilles de composants
tests/         harnais maison + tests du moteur
tools/         scripts d'analyse hors jeu
docs/          inventaire des assets
```

Règles d'architecture, non négociables :

1. **Le moteur est pur et déterministe.** `applyAction(state, action) -> newState`.
   Un même state et une même action donnent toujours le même résultat.
2. **Tout l'aléatoire passe par le PRNG seedé** stocké dans le state — jamais
   `Math.random()` (seule exception : le tirage de la graine initiale).
3. La résolution renvoie une **liste d'événements** `{ type, payload }` que la vue
   rejoue en animations. La vue ne recalcule jamais de logique.
4. Le state est **JSON pur** : `saveState` / `loadState`.

Ces contraintes servent le replay, les tests, une IA future et le multijoueur.

## État d'avancement

- [x] **Palier 1** — moteur pur : PRNG seedé, génération de plateau, régions de
      biome, structure du state, sérialisation, tests.
- [ ] Palier 2 — instincts, résolution mouvement/combat (sans UI).
- [ ] Palier 3 — rendu de la grille, placement, invocations, tour par tour.
- [ ] Palier 4 — cartes : deck, pioche, main, ciblage, effets, durées.
- [ ] Palier 5 — prévisualisations (vision, cible, case suivante, cibles légales).
- [ ] Palier 6 — animations et direction artistique complète.
- [ ] Palier 7 — écrans annexes, sauvegarde locale.
- [ ] Palier 8 — passe d'équilibrage et mode debug.

`index.html` affiche pour l'instant le **harnais de mise au point du palier 1** :
génération de plateau, frontières de région, statistiques, graine réglable.

## Équilibrage

Toutes les valeurs chiffrées sont centralisées dans `BALANCE`
(`js/engine/constants.js`) : coûts, stats des créatures, durées d'effet,
énergie, mort subite, contraintes de génération.
