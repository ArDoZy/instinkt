# Prompts ChatGPT — les 25 assets à fournir

Ce fichier accompagne [`ASSETS.md`](ASSETS.md). Il contient les prompts prêts à
coller pour obtenir les 25 fichiers marqués « à fournir » : 6 silhouettes de
créature, 16 médaillons de carte, le dos de pioche, le logo et le favicon.

**Tous les assets sont du SVG intégré en ligne dans `js/ui/assets.js`.** On
demande donc à ChatGPT du *code SVG*, pas une image : un PNG généré par
DALL·E ne s'intègre pas sans retouche et ne respecte ni `currentColor` ni la
contrainte « pas de dégradé » (§8). Utiliser un modèle de raisonnement texte
(GPT‑5 Thinking ou équivalent), pas le générateur d'images.

Ordre conseillé : prompt 0 (contexte, une seule fois, en tête de conversation),
puis les prompts 1 à 5 dans la même conversation pour garder la cohérence de
style.

---

## Prompt 0 — contexte de direction artistique (à coller en premier)

> Tu es directeur artistique et illustrateur SVG. Nous travaillons sur
> **Instynkt**, un jeu de plateau tactique en 2D, vue de dessus, sur navigateur.
> La direction artistique est celle d'une **planche de naturaliste du XIXᵉ** :
> trait d'encre sur parchemin, aplats francs, aucune couleur criarde.
>
> Règles absolues, valables pour tous les assets que je vais te demander :
>
> 1. **Aucun dégradé, aucune ombre portée, aucun flou, aucun filtre.** Uniquement
>    des aplats et des traits pleins. Pas de `<filter>`, `<linearGradient>`,
>    `<radialGradient>`, `<image>`, ni de balise `<style>`.
> 2. **Monochrome.** La couleur vient du CSS : n'utilise que `currentColor` pour
>    les remplissages et les traits. Les nuances se font par `opacity`
>    (0.25 à 1), jamais par une couleur en dur.
> 3. **SVG pur et minimal** : `<path>`, `<circle>`, `<ellipse>`, `<rect>`,
>    `<polygon>`, `<g>`. Pas de `<text>` sauf si je le demande explicitement.
>    Coordonnées à une décimale maximum, pas de `transform` imbriqué inutile.
> 4. **viewBox imposée** pour chaque asset, jamais d'attributs `width`/`height`.
>    Format exact attendu :
>    `<svg viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg" fill="none">…</svg>`
> 5. **Lisibilité avant détail** : ces dessins sont affichés petit (parfois 32 px
>    de côté). Une forme doit rester identifiable à cette taille. Moins de 15
>    éléments par asset. Épaisseur de trait ≥ 1.5 unités.
> 6. Style de trait : `stroke-linecap="round"`, `stroke-linejoin="round"`.
>
> Palette du jeu, pour information seulement (ne l'écris jamais dans le SVG) :
> encre `#1b1f1a`, parchemin `#e8e2d2`, sang `#a63a2e`, azur `#3b6e8f`,
> ambre `#e0a63c`.
>
> Réponds « prêt » et attends ma première demande.

---

## Prompt 1 — les 6 silhouettes de créature (`viewBox 0 0 64 64`)

Contrainte spécifique : le glyphe d'instinct est **surimprimé au centre** par le
moteur. La silhouette doit donc laisser le carré central (environ 20 → 44 sur
les deux axes) visuellement peu chargé.

> Dessine-moi **6 silhouettes de créature**, vues **strictement de dessus**
> (à la verticale, comme une empreinte ou un pictogramme de plan), en
> `viewBox="0 0 64 64"`.
>
> Contraintes propres à ces silhouettes :
> - **Pleines**, en `fill="currentColor"` — pas de contour clair, pas de traits
>   intérieurs de détail (pas d'œil, pas de rayure, pas de poil).
> - Le **centre du carré (x 20→44, y 20→44) doit rester peu chargé** : un glyphe
>   y sera surimprimé. Concentre la masse sur la périphérie, ou évide le centre.
> - Elles doivent se distinguer **par la silhouette et la posture uniquement**,
>   pas par la taille : chacune occupe la même surface apparente.
> - Chaque forme touche presque les bords (marge ~4 unités), sans les dépasser.
>
> Les 6 créatures, dans cet ordre :
> 1. **Fuyard** — petit herbivore ramassé, corps allongé dans l'axe, pattes
>    fines écartées, posture de départ en course.
> 2. **Charognard** — oiseau au sol, ailes repliées le long du corps, dos voûté,
>    tête rentrée dans les épaules.
> 3. **Protecteur** — masse large et basse, carapace ovale, membres à peine
>    visibles sous la coque.
> 4. **Territorial** — quadrupède trapu, campé sur ses quatre appuis bien
>    écartés, symétrie marquée.
> 5. **Dominant** — épaules hautes et larges, tête basse rentrée entre les
>    épaules, arrière-train plus étroit (silhouette en triangle).
> 6. **Chasseur** — félin en extension, corps tendu vers l'avant, allongé,
>    pattes en appui asymétrique.
>
> Rends-moi les 6 SVG, chacun dans un bloc de code séparé, précédé du nom de
> fichier (`creature-fuyard.svg`, etc.), sans autre commentaire.

---

## Prompt 2 — les 16 médaillons de carte (`viewBox 0 0 120 96`)

> **Note dimension** : `ASSETS.md` annonce 160×120, mais le code
> (`cardArt()` dans `js/ui/assets.js`) rend en `viewBox="0 0 120 96"`. C'est
> cette dernière qui fait foi — c'est celle utilisée dans les prompts.

À découper en 3 envois (un par catégorie) : ChatGPT tient mieux la cohérence sur
6 dessins que sur 16 d'un coup.

### 2a — cartes Instinct (6)

> Dessine-moi **6 médaillons de carte** en `viewBox="0 0 120 96"`, style
> **gravure de planche naturaliste** : trait d'encre, hachures pour les valeurs,
> aucun aplat massif. Le médaillon est une vignette en haut d'une carte à jouer.
>
> Contraintes propres aux médaillons :
> - Essentiellement du **trait** (`stroke="currentColor"`, `fill="none"`),
>   épaisseur 1.5 à 2.5. Les aplats pleins sont réservés à quelques petites
>   masses de contraste.
> - Les valeurs se font par **hachures parallèles** ou par `opacity`, jamais par
>   un remplissage gris.
> - Composition **centrée**, marge de 8 unités sur tous les bords.
> - Une seule idée visuelle forte par vignette, lisible à 120 px de large.
>
> Les 6 sujets :
> 1. `carte-retour_instinct_primordial.svg` — crâne d'animal dont la mâchoire se
>    rouvre.
> 2. `carte-peur_devorante.svg` — un troupeau qui se disloque, lignes de fuite
>    divergentes.
> 3. `carte-terrain_sacre.svg` — cercle de pierres levées sur un sol hachuré.
> 4. `carte-obsession.svg` — deux silhouettes reliées par un fil tendu.
> 5. `carte-panique_collective.svg` — nuée d'oiseaux jaillissant d'un carré.
> 6. `carte-hierarchie_brisee.svg` — bois de cerf fendu en deux.
>
> Un bloc de code par fichier, précédé du nom de fichier.

### 2b — cartes Buff (4)

> Mêmes contraintes et même style que les médaillons précédents,
> `viewBox="0 0 120 96"`. Les 4 sujets :
> 1. `carte-frenesie.svg` — gueule ouverte de profil, traits de vitesse derrière.
> 2. `carte-appat.svg` — une carcasse posée au centre d'un cercle de traces de
>    pattes.
> 3. `carte-lune_de_sang.svg` — disque lunaire plein, entièrement hachuré.
> 4. `carte-carapace.svg` — dossière de tortue vue de dessus, écailles
>    géométriques.

### 2c — cartes Terrain (6)

> Mêmes contraintes et même style, `viewBox="0 0 120 96"`. Ces six-là sont des
> **paysages** : garde une ligne d'horizon basse et cohérente entre elles.
> 1. `carte-brouillard_epais.svg` — bandes horizontales estompant un relief.
> 2. `carte-ecaille_de_pierre.svg` — écailles minérales imbriquées.
> 3. `carte-feu_de_foret.svg` — troncs calcinés, fumée en volutes.
> 4. `carte-secheresse.svg` — sol craquelé en polygones irréguliers.
> 5. `carte-poussee_volcanique.svg` — une faille qui soulève une dalle.
> 6. `carte-fertilisation.svg` — une pousse perçant un éboulis.

---

## Prompt 3 — dos de pioche (`viewBox 0 0 90 126`)

> Dessine-moi le **dos d'une carte à jouer** en `viewBox="0 0 90 126"`, pour un
> jeu au style planche naturaliste.
>
> Contraintes :
> - Un **cadre double** : bord extérieur épais, filet intérieur fin en opacité
>   réduite, à ~6 unités du bord.
> - À l'intérieur, une **trame d'encre répétée** (hachures, semis de points ou
>   motif géométrique simple) couvrant la surface en opacité 0.25 à 0.4.
> - Au centre, un **monogramme « IK »** en lettres capitales étroites, tracé en
>   `<path>` (pas de `<text>` — la police n'est pas garantie), posé dans une
>   réserve laissée libre par la trame.
> - Tout en `currentColor`. Le fond de la carte est peint par le CSS : ne mets
>   pas de rectangle de fond opaque, ou alors en `fill="none"`.
> - Symétrique par rotation de 180° si possible (un dos de carte se regarde dans
>   les deux sens).
>
> Nom de fichier : `pile-pioche.svg`.

---

## Prompt 4 — logo (`viewBox 0 0 320 80`)

> Dessine-moi le **logo du jeu Instynkt** en `viewBox="0 0 320 80"`.
>
> - Le mot **INSTYNKT** en capitales, lettrage **condensé et anguleux**, tracé
>   entièrement en `<path>` vectoriels (surtout pas de `<text>` : la police n'est
>   pas garantie à l'affichage). Rempli en `currentColor`.
> - Interlettrage large, le mot occupe environ 240 unités de large, centré.
> - Sous le mot, un **filet naturaliste** : une ligne horizontale fine, doublée
>   d'un petit ornement central discret (deux ou trois traits courts, façon
>   marque de planche gravée), en opacité réduite.
> - Rien d'autre : pas de créature, pas de cadre, pas de sous-titre.
>
> Nom de fichier : `logo-instynkt.svg`.

---

## Prompt 5 — favicon (`viewBox 0 0 32 32`)

> Dessine-moi un **favicon** en `viewBox="0 0 32 32"` : une **empreinte animale**
> monochrome, pleine, en `fill="currentColor"`.
>
> - Un coussinet central + 3 ou 4 doigts. C'est tout.
> - Formes **massives et bien séparées** : ça doit rester lisible à 16 px.
>   Écart minimum de 1.5 unité entre deux formes, aucune forme de moins de
>   3 unités de large.
> - Marge de 3 unités sur tous les bords, empreinte légèrement inclinée pour
>   éviter la symétrie parfaite.
>
> Nom de fichier : `favicon.svg`.

---

## Prompt 6 — reprise, si un résultat déçoit

> Ce SVG ne va pas : [décris le problème — trop chargé au centre / illisible en
> petit / trait trop fin / on ne reconnaît pas le sujet]. Refais-le en gardant la
> même viewBox et les mêmes règles, mais [simplifie à 8 éléments maximum /
> épaissis les traits à 2.5 / dégage le carré central / accentue la posture].
> Ne change pas le style général : les autres assets de la série doivent rester
> cohérents avec celui-ci.

---

## Vérifier avant d'intégrer

Un SVG rendu par ChatGPT est bon s'il coche tout ceci :

- [ ] `viewBox` exacte, pas d'attribut `width` ni `height` ;
- [ ] aucune couleur en dur — que `currentColor` (`grep -o '#[0-9a-fA-F]\{3,6\}'` ne doit rien remonter) ;
- [ ] aucun `<filter>`, `<linearGradient>`, `<radialGradient>`, `<style>`, `<image>` ;
- [ ] aucun `<text>`, sauf le cas explicitement autorisé ;
- [ ] lisible à sa taille réelle d'affichage (dézoomer pour vérifier) ;
- [ ] pour les silhouettes : centre dégagé, le glyphe surimprimé reste lisible.

## Intégrer

Rien à créer comme fichier : le jeu lit ces assets depuis `js/ui/assets.js`.
Coller le **contenu intérieur** du SVG (sans la balise `<svg>` englobante) dans
l'entrée correspondante :

| Asset | Emplacement dans `js/ui/assets.js` |
|---|---|
| silhouettes | `SILHOUETTES[INSTINCTS.…]` |
| médaillons | `cardArt()` — remplacer le placeholder par une table `id de carte → SVG` |
| dos de pioche | la constante du dos de carte (`viewBox 0 0 90 126`) |
| logo | `LOGO` |
| favicon | `index.html`, balise `<link rel="icon">` |

Les identifiants de carte sont ceux de `js/engine/constants.js` (`frenesie`,
`lune_de_sang`, …) et correspondent aux noms de fichiers ci-dessus.
