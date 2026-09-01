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
js/engine/       moteur pur, déterministe, zéro accès au DOM
  prng.js          PRNG mulberry32 seedé, état sérialisable
  constants.js     BALANCE, biomes, instincts, les 16 cartes
  geometry.js      grille 8×8, distance de Chebyshev, voisinages
  board.js         génération par croissance de graines, régions de biome
  state.js         structure du state, sérialisation, lecture
  effects.js       effets portés et globaux, décompte des durées
  creatures.js     statistiques effectives, changement d'instinct
  vision.js        portée de perception, cas du Territorial
  pathfinding.js   plus court chemin 8 directions sur cases libres
  instincts.js     les six algorithmes et la priorité de ciblage
  cards.js         cibles légales et effets des 16 cartes
  resolution.js    mouvement, combat simultané, régénération, fin de partie
  engine.js        applyAction(state, action) -> newState
  textview.js      rendu texte du plateau (mise au point)
js/ui/           couche vue : seule à toucher le DOM
  app.js           enchaînement des écrans, ciblage, chrono, sauvegarde
  game-screen.js   plateau, inspecteur, main, invocations
  board-view.js    grille, créatures, surbrillances
  preview.js       prévisualisations, toutes lues depuis le moteur
  animator.js      rejoue la file d'événements en animations
  screens.js       accueil, deckbuilding, passage, fin de partie, règles
  assets.js        glyphes, silhouettes et icônes en SVG
css/             jetons de design puis feuilles de composants
dev/             pages de mise au point (génération, prévisualisations)
tests/           harnais maison + tests du moteur
tools/           scripts d'analyse hors jeu
docs/            inventaire des assets
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

- [x] Palier 1 — moteur pur : PRNG, plateau, régions, state, sérialisation.
- [x] Palier 2 — instincts, résolution mouvement/combat, fin de partie.
- [x] Palier 3 — rendu de la grille, placement, invocations, tour par tour.
- [x] Palier 4 — cartes : deck, pioche, main, ciblage, effets, durées.
- [x] Palier 5 — prévisualisations (vision, cible, case suivante, cibles légales).
- [x] Palier 6 — animations et direction artistique.
- [x] Palier 7 — écrans annexes, sauvegarde locale.
- [x] Palier 8 — passe d'équilibrage, `BALANCE` exposé, mode debug.

Pages de mise au point, hors du jeu :

- `dev/generation.html` — génération de plateau, régions, statistiques.
- `dev/apercu.html` — banc d'essai des prévisualisations.

## Équilibrage

Toutes les valeurs chiffrées sont centralisées dans `BALANCE`
(`js/engine/constants.js`) : coûts, stats des créatures, durées d'effet,
énergie, mort subite, contraintes de génération.

Deux outils mesurent l'effet d'un réglage :

```sh
npm run sim         # parties complètes par actions légales aléatoires
node tools/balance.mjs 40   # matrice instinct contre instinct, sans carte
```

La matrice isole la valeur d'une créature, mais elle mesure surtout la capacité
à **engager** le combat : un instinct qui refuse d'attaquer la plupart des
cibles (dominant, charognard) y perd par construction, et le fuyard, qui
n'attaque jamais, y fait 0 %. Ce n'est pas un défaut d'équilibrage, c'est
l'identité du jeu — ces créatures se jouent en appui, ce qu'un duel isolé ne
sait pas mesurer.

Le coût reflète donc l'initiative plutôt que la puissance brute : chasseur 4⚡,
territorial et protecteur 3⚡, dominant et charognard 2⚡, fuyard 1⚡.

Mode debug, dans l'inspecteur : affiche la vision de toutes les créatures et
permet d'avancer d'un tour à vide.
