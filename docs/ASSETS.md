# Instynkt — inventaire des assets visuels

> **État** : tout ce qui figure ci-dessous est en place dans `js/ui/assets.js`,
> soit en version définitive (glyphes, textures, icônes), soit en placeholder
> géométrique jouable (silhouettes, médaillons, dos de carte, logo). Le jeu est
> complet et lisible tel quel ; les 25 fichiers de la liste « à fournir » sont
> des remplacements, pas des manques bloquants.

Colonne **Source** :

- **moteur** : SVG généré en ligne par le code, aucun fichier à fournir ;
- **placeholder** : je génère une forme SVG provisoire, remplaçable par un fichier définitif ;
- **à fournir** : rien ne remplace un vrai dessin — un placeholder tiendra la place en attendant.

Colonne **Priorité** : *bloquant* = le jeu n'est pas jouable ou pas lisible sans ;
*confort* = améliore la finition.

Toutes les dimensions sont données en unités SVG (viewBox), le rendu étant vectoriel
et redimensionné par CSS.

## 1. Glyphes d'instinct — l'identité se lit d'abord ici (§8)

Monochromes, une seule couleur (`currentColor`), lisibles à 14 px comme à 64 px,
pleins plutôt que filaires.

| Fichier | Type | Dim. | Description | Source | Priorité |
|---|---|---|---|---|---|
| `glyphe-roi.svg` | SVG | 24×24 | Couronne pleine : l'enjeu de la partie | moteur | bloquant |
| `glyphe-protecteur.svg` | SVG | 24×24 | Arc bombé posé sur un point (corps abrité) | moteur | bloquant |
| `glyphe-territorial.svg` | SVG | 24×24 | Cadre fermé avec une marque au centre (borne) | moteur | bloquant |
| `glyphe-chasseur.svg` | SVG | 24×24 | Pointe / triangle allongé avec ligne de visée | moteur | bloquant |
| `glyphe-tueur-de-roi.svg` | SVG | 24×24 | Lame en travers d'une couronne | moteur | bloquant |
| `glyphe-fuyard.svg` | SVG | 24×24 | Trois traits de fuite : l'état de panique infligé par carte | moteur | bloquant |

## 2. Silhouettes de créature

Vue de dessus, monochromes dans la couleur du joueur (`--sang` / `--azur`),
sans contour clair, posées dans un carré. Le glyphe est surimprimé par le code :
la silhouette ne doit donc pas être chargée au centre.

| Fichier | Type | Dim. | Description | Source | Priorité |
|---|---|---|---|---|---|
| `creature-roi.svg` | SVG | 64×64 | Masse imposante, épaules larges, couronne suggérée | placeholder → à fournir | bloquant |
| `creature-protecteur.svg` | SVG | 64×64 | Masse large et basse, carapace ovale | placeholder → à fournir | bloquant |
| `creature-territorial.svg` | SVG | 64×64 | Quadrupède trapu campé sur ses appuis | placeholder → à fournir | bloquant |
| `creature-chasseur.svg` | SVG | 64×64 | Félin en extension, corps tendu vers l'avant | placeholder → à fournir | bloquant |
| `creature-tueur-de-roi.svg` | SVG | 64×64 | Silhouette effilée, encapuchonnée, tendue vers l'avant | placeholder → à fournir | bloquant |
| `creature-fuyard.svg` | SVG | 64×64 | Petit herbivore ramassé, pattes fines, corps allongé | placeholder → à fournir | bloquant |

> Les placeholders en place sont des silhouettes distinctes par leurs proportions
> et leur posture : le jeu est intégralement lisible sans les dessins finaux,
> puisque l'identité passe par le glyphe surimprimé.

### Comment fournir un remplacement

Une silhouette est un SVG en `viewBox="0 0 64 64"`, tracé en `fill="currentColor"`
(la couleur du joueur est appliquée par le CSS), sans contour clair et sans
charger le centre, que le glyphe occupe. Il suffit de coller le contenu dans
`SILHOUETTES[instinct]` (`js/ui/assets.js`) ; rien d'autre ne change.

## 3. Textures de biome

Motifs répétables, très discrets (opacité 0,15–0,3 sur la couleur de fond),
en encre sur la teinte du biome — jamais de dégradé (§8).

| Fichier | Type | Dim. | Description | Source | Priorité |
|---|---|---|---|---|---|
| `texture-foret.svg` | pattern SVG/CSS | 8×8 tuile | Hachures à 45°, espacées | moteur | bloquant |
| `texture-jungle.svg` | pattern SVG/CSS | 8×8 tuile | Double hachurage croisé, plus dense | moteur | bloquant |
| `texture-plaine.svg` | pattern SVG/CSS | 8×8 tuile | Traits verticaux fins, espacés | moteur | bloquant |
| `texture-desert.svg` | pattern SVG/CSS | 7×7 tuile | Semis de points (granulé) | moteur | bloquant |
| `texture-montagne.svg` | pattern SVG/CSS | 8×8 tuile | Hachures serrées à 135°, plus appuyées | moteur | bloquant |

*(Implémentées en CSS dans `css/board.css`.)*

## 4. Illustrations de carte (15)

Médaillon en haut de la carte, style planche de naturaliste : trait d'encre sur
parchemin, pas d'aplat de couleur vive.

| Fichier | Type | Dim. | Description | Source | Priorité |
|---|---|---|---|---|---|
| `carte-retour_instinct_primordial.svg` | SVG | 160×120 | Crâne d'animal dont la mâchoire se rouvre | placeholder → à fournir | confort |
| `carte-peur_devorante.svg` | SVG | 160×120 | Troupeau qui se disloque, lignes de fuite | placeholder → à fournir | confort |
| `carte-terrain_sacre.svg` | SVG | 160×120 | Cercle de pierres levées sur un sol hachuré | placeholder → à fournir | confort |
| `carte-obsession.svg` | SVG | 160×120 | Deux silhouettes reliées par un fil tendu | placeholder → à fournir | confort |
| `carte-panique_collective.svg` | SVG | 160×120 | Nuée d'oiseaux jaillissant d'un carré | placeholder → à fournir | confort |
| `carte-frenesie.svg` | SVG | 160×120 | Gueule ouverte, traits de vitesse | placeholder → à fournir | confort |
| `carte-appat.svg` | SVG | 160×120 | Carcasse posée au centre d'un cercle de traces | placeholder → à fournir | confort |
| `carte-lune_de_sang.svg` | SVG | 160×120 | Disque lunaire plein, hachuré | placeholder → à fournir | confort |
| `carte-carapace.svg` | SVG | 160×120 | Dossière de tortue vue de dessus | placeholder → à fournir | confort |
| `carte-brouillard_epais.svg` | SVG | 160×120 | Bandes horizontales estompant un relief | placeholder → à fournir | confort |
| `carte-ecaille_de_pierre.svg` | SVG | 160×120 | Écailles minérales imbriquées | placeholder → à fournir | confort |
| `carte-feu_de_foret.svg` | SVG | 160×120 | Troncs calcinés, fumée en volutes | placeholder → à fournir | confort |
| `carte-secheresse.svg` | SVG | 160×120 | Sol craquelé en polygones | placeholder → à fournir | confort |
| `carte-poussee_volcanique.svg` | SVG | 160×120 | Faille qui soulève une dalle | placeholder → à fournir | confort |
| `carte-fertilisation.svg` | SVG | 160×120 | Pousse perçant un éboulis | placeholder → à fournir | confort |

> Placeholder en place : le médaillon affiche un motif géométrique dérivé de la
> catégorie (instinct / buff / terrain) et l'initiale du nom en display. Les cartes
> sont jouables et distinguables sans illustration — voir `cardArt()`.

## 5. Interface

| Fichier | Type | Dim. | Description | Source | Priorité |
|---|---|---|---|---|---|
| `icone-energie.svg` | SVG | 16×16 | Cristal en losange, ambre — vide / plein | moteur | bloquant |
| `pile-pioche.svg` | SVG | 90×126 | Dos de carte : trame d'encre sur parchemin + monogramme | placeholder → à fournir | bloquant |
| `marqueur-leurre.svg` | SVG | 32×32 | Croix d'appât cerclée, posée au sol | moteur | bloquant |
| `particules-mort.svg` | sprite SVG | 64×64, 6 formes | Éclats irréguliers pour la dissolution | moteur | confort |
| `barre-pv.svg` | — | — | Rectangle plein, rendu en CSS | moteur | bloquant |
| `marqueur-blesse.svg` | SVG | 12×12 | Goutte / entaille signalant PV < 50 % | moteur | bloquant |
| `icone-cible.svg` | SVG | 16×16 | Réticule pour le trait créature → cible | moteur | confort |
| `icone-mort-subite.svg` | SVG | 16×16 | Sablier écoulé, pour la bannière de manche 30+ | moteur | confort |
| `logo-instynkt.svg` | SVG | 320×80 | Titre en display, lettrage à l'encre, filet naturaliste | placeholder → à fournir | confort |
| `favicon.svg` | SVG | 32×32 | Empreinte animale monochrome | placeholder → à fournir | confort |
| `fond-parchemin.svg` | pattern SVG | 128×128 tuile | Grain de papier très léger pour les cartes | moteur | confort |

## 6. Polices

| Ressource | Usage | Source | Priorité |
|---|---|---|---|
| Oswald (300/400/500) | Titres, noms de cartes, chiffres de stats | Google Fonts | bloquant |
| Inter (400/600) | Corps, journal, inspecteur | Google Fonts | bloquant |

> Si tu préfères l'axe naturaliste pour les titres, Bitter se substitue à Oswald
> sans autre changement que la variable `--font-display`.

## Résumé

- **Rien de bloquant n'est à fournir** : tout ce qui l'est est généré par le moteur
  ou remplacé par un placeholder géométrique jouable.
- **À fournir pour la finition** : les 6 silhouettes de créature, les 15 médaillons
  de carte, le dos de pioche, le logo et le favicon — soit **24 fichiers**.
- Le plateau fait 16×16 : une silhouette est rendue autour de 38 px de côté en
  1440×900. Elle doit rester lisible à cette taille — c'est le glyphe qui porte
  l'identité, la silhouette ne fait que donner la masse et la posture.
