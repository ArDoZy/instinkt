# Instynkt

Jeu de stratégie tour par tour, 2 joueurs en hot-seat, en JavaScript vanilla
(modules ES6, aucune dépendance, aucun build step).

Particularité : **on ne déplace jamais ses créatures**. Chacune obéit à un
instinct — un algorithme simple et prévisible. Le joueur agit indirectement :
il invoque, modifie les instincts, transforme le terrain, buffe et débuffe.

Chaque joueur pose un **Roi** avant la partie, et gagne en tuant celui d'en
face. Le Roi fuit le combat, ne riposte que si on le frappe, et **ne se
régénère jamais** : chaque point de vie qu'on lui prend est acquis. C'est ce
qui donne à la partie un sens de progression plutôt qu'un cycle.

## Lancer

```sh
npm run dev       # sert la racine sur http://localhost:8000 (alias : npm run serve)
npm run dev 3000  # sur un autre port
npm test          # tests du moteur (node, sans dépendance)
npm run stats     # statistiques de génération de plateau
```

Le jeu se joue dans le navigateur, **via un serveur local** : ouvrir `index.html`
en `file://` ne marche pas, le navigateur bloque les modules ES6.

Le serveur (`tools/serve.mjs`) tient en un fichier Node sans dépendance. Si le
port est déjà occupé — un terminal laissé ouvert, par exemple — il prend le
suivant et l'annonce, plutôt que de s'arrêter sur `EADDRINUSE`. Dans un
Codespace il écoute sur `0.0.0.0` : GitHub propose alors le port dans l'onglet
**Ports**, il suffit d'ouvrir l'URL transférée. Aucune installation n'est
nécessaire, il n'y a pas de `node_modules`.

## Architecture

```
js/engine/       moteur pur, déterministe, zéro accès au DOM
  prng.js          PRNG mulberry32 seedé, état sérialisable
  constants.js     BALANCE, biomes, instincts, les 16 cartes
  geometry.js      grille 16×16, distance de Chebyshev, voisinages
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
tools/           scripts d'analyse hors jeu (dont un modèle de joueur)
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
npm run sim                 # robustesse : actions légales aléatoires
npm run sim -- 200 --oriente   # rythme réel : un joueur qui vise le Roi adverse
node tools/balance.mjs 40      # matrice instinct contre instinct, sans carte
```

Les deux modes disent deux choses différentes. Le mode aléatoire vérifie que le
moteur encaisse n'importe quelle suite d'actions légales. Le mode orienté
(`tools/ai.mjs`, un modèle de joueur sommaire qui pousse vers le Roi adverse)
mesure le rythme : **100 % des parties s'y concluent par régicide, en une
vingtaine de manches**, sans que la mort subite ait à intervenir.

La matrice des duels isole la valeur d'une créature, mais elle mesure surtout
la capacité à conclure : le Tueur de Roi y domine parce qu'il est le seul à
menacer directement l'enjeu, et le Protecteur y fait 0 % parce qu'une armée de
protecteurs ne tue personne. Ce n'est pas un défaut d'équilibrage — c'est la
forme du jeu, qu'un duel à une seule créature ne sait pas rendre.

Ouvrir la partie étant un avantage de tempo, le joueur qui ouvre touche une
première rente d'énergie réduite (`energy.openingPenalty`) — une compensation
façon komi, calibrée à la mesure.

Mode debug, dans l'inspecteur : affiche la vision de toutes les créatures et
permet d'avancer d'un tour à vide.
