/**
 * Assets SVG générés en ligne.
 *
 * Tout ce qui est bloquant pour la lisibilité est ici : glyphes d'instinct,
 * silhouettes, icônes. Les fichiers définitifs (dessins de créature, médaillons
 * de carte) remplaceront les formes ci-dessous sans changer l'interface —
 * voir docs/ASSETS.md.
 */

import { CARD_CATEGORIES, INSTINCTS } from '../engine/index.js';

const svg = (viewBox, body, attrs = '') =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" fill="none" ${attrs}>${body}</svg>`;

/**
 * Glyphes d'instinct — l'identité d'une créature se lit d'abord ici (§8).
 * Monochromes, en currentColor, lisibles de 14 px à 64 px.
 */
export const GLYPHS = {
  // Trois traits de fuite qui s'échappent vers la droite.
  [INSTINCTS.FUYARD]: svg(
    '0 0 24 24',
    `<path d="M4 8h9M2 12h11M4 16h9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
     <path d="M15 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  ),
  // Couronne : l'enjeu de la partie, reconnaissable au premier coup d'œil.
  [INSTINCTS.ROI]: svg(
    '0 0 24 24',
    `<path d="M3 8l4 5 5-8 5 8 4-5v10H3z" fill="currentColor"/>
     <path d="M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`
  ),
  // Un corps abrité sous un arc.
  [INSTINCTS.PROTECTEUR]: svg(
    '0 0 24 24',
    `<path d="M3 15a9 9 0 0 1 18 0" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
     <circle cx="12" cy="16.5" r="3" fill="currentColor"/>`
  ),
  // Une borne : cadre fermé, marque au centre.
  [INSTINCTS.TERRITORIAL]: svg(
    '0 0 24 24',
    `<rect x="3.5" y="3.5" width="17" height="17" rx="1" stroke="currentColor" stroke-width="2.2"/>
     <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor"/>`
  ),
  // Lame en travers d'une couronne : le tueur de Roi ne vise que lui.
  [INSTINCTS.TUEUR_DE_ROI]: svg(
    '0 0 24 24',
    `<path d="M12 1l2.4 4.4L19 3.6l-1.4 5H6.4L5 3.6l4.6 1.8z" fill="currentColor" opacity=".55"/>
     <path d="M12 6.5l3 4.5-3 12-3-12z" fill="currentColor"/>
     <path d="M6.5 11h11" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>`
  ),
  // Pointe de visée.
  [INSTINCTS.CHASSEUR]: svg(
    '0 0 24 24',
    `<path d="M12 2l5 12-5-3-5 3z" fill="currentColor"/>
     <path d="M12 15v7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`
  ),
};

/**
 * Silhouettes vues de dessus. Volontairement abstraites : ce sont des
 * placeholders assumés, l'information passe par le glyphe surimprimé.
 * Le centre est laissé libre pour ne pas concurrencer le glyphe.
 */
export const SILHOUETTES = {
  // Petit herbivore ramassé, corps allongé.
  [INSTINCTS.FUYARD]: svg(
    '0 0 64 64',
    `<ellipse cx="32" cy="34" rx="13" ry="19" fill="currentColor"/>
     <circle cx="32" cy="13" r="7" fill="currentColor"/>
     <path d="M22 52l-5 8M42 52l5 8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`
  ),
  // Masse imposante, épaules larges, couronne suggérée.
  [INSTINCTS.ROI]: svg(
    '0 0 64 64',
    `<path d="M13 22h38v22c0 9-8 15-19 15s-19-6-19-15z" fill="currentColor"/>
     <path d="M13 22l5-13 7 8 7-12 7 12 7-8 5 13z" fill="currentColor"/>`
  ),
  // Masse large et basse, carapace ovale.
  [INSTINCTS.PROTECTEUR]: svg(
    '0 0 64 64',
    `<ellipse cx="32" cy="33" rx="25" ry="21" fill="currentColor"/>
     <circle cx="32" cy="9" r="6" fill="currentColor"/>
     <path d="M9 46l-5 6M55 46l5 6" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`
  ),
  // Quadrupède trapu campé sur ses appuis.
  [INSTINCTS.TERRITORIAL]: svg(
    '0 0 64 64',
    `<rect x="12" y="16" width="40" height="34" rx="10" fill="currentColor"/>
     <circle cx="32" cy="11" r="7" fill="currentColor"/>
     <path d="M14 50l-6 8M50 50l6 8M24 52v9M40 52v9" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`
  ),
  // Silhouette effilée, encapuchonnée, tendue vers l'avant.
  [INSTINCTS.TUEUR_DE_ROI]: svg(
    '0 0 64 64',
    `<path d="M32 4c7 0 12 7 12 15 0 5-2 9-2 13l6 28H16l6-28c0-4-2-8-2-13C20 11 25 4 32 4z" fill="currentColor"/>
     <path d="M20 26l-9 6M44 26l9 6" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`
  ),
  // Félin en extension, corps tendu vers l'avant.
  [INSTINCTS.CHASSEUR]: svg(
    '0 0 64 64',
    `<path d="M32 4c9 0 15 9 15 20v18c0 11-6 18-15 18s-15-7-15-18V24C17 13 23 4 32 4z" fill="currentColor"/>
     <path d="M17 22l-9-8M47 22l9-8M32 60v-6" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>`
  ),
};

/** Cristal d'énergie. */
export const ENERGY_ICON = svg(
  '0 0 16 16',
  `<path d="M8 1l5 7-5 7-5-7z" fill="currentColor"/>`
);

export const ENERGY_ICON_EMPTY = svg(
  '0 0 16 16',
  `<path d="M8 1l5 7-5 7-5-7z" stroke="currentColor" stroke-width="1.4" opacity=".45"/>`
);

/** Marqueur de leurre : croix d'appât cerclée, posée au sol. */
export const LURE_MARKER = svg(
  '0 0 32 32',
  `<circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>
   <path d="M16 8v16M8 16h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`
);

/** Marqueur de créature sous 50 % de PV — information stratégique (§7). */
export const WOUNDED_MARKER = svg(
  '0 0 12 12',
  `<path d="M6 1l4 7a4 4 0 1 1-8 0z" fill="currentColor"/>`
);

/** Réticule utilisé par le trait créature → cible. */
export const TARGET_ICON = svg(
  '0 0 16 16',
  `<circle cx="8" cy="8" r="5" stroke="currentColor" stroke-width="1.6"/>
   <path d="M8 0v3M8 13v3M0 8h3M13 8h3" stroke="currentColor" stroke-width="1.6"/>`
);

/** Dos de carte : trame d'encre et monogramme. */
export const CARD_BACK = svg(
  '0 0 90 126',
  `<rect x="1" y="1" width="88" height="124" rx="3" fill="var(--parchemin)" stroke="var(--encre)" stroke-width="2"/>
   <rect x="7" y="7" width="76" height="112" rx="2" fill="none" stroke="var(--encre)" stroke-width="1" opacity=".5"/>
   <path d="M7 30h76M7 96h76" stroke="var(--encre)" stroke-width="1" opacity=".3"/>
   <text x="45" y="70" text-anchor="middle" font-family="Oswald, sans-serif" font-size="26"
         fill="var(--encre)" opacity=".7">IK</text>`
);

/** Logo : lettrage à l'encre et filet naturaliste. */
export const LOGO = svg(
  '0 0 320 80',
  `<text x="160" y="46" text-anchor="middle" font-family="Oswald, sans-serif" font-size="42"
         letter-spacing="10" fill="currentColor">INSTYNKT</text>
   <path d="M40 58h240" stroke="currentColor" stroke-width="1.5" opacity=".5"/>
   <path d="M150 64h20M144 68h32" stroke="currentColor" stroke-width="1.2" opacity=".3"/>`
);

/**
 * Médaillon de carte : motif dérivé de la catégorie, plus l'initiale du nom.
 * Placeholder assumé, remplaçable fichier par fichier (docs/ASSETS.md).
 */
export function cardArt(card) {
  const motifs = {
    [CARD_CATEGORIES.INSTINCT]: `<path d="M20 70c20-40 60-40 80 0" stroke="currentColor" stroke-width="2" opacity=".55"/>
       <circle cx="60" cy="46" r="16" stroke="currentColor" stroke-width="2" opacity=".7"/>`,
    [CARD_CATEGORIES.BUFF]: `<path d="M60 18l10 26 26 4-19 18 5 26-22-13-22 13 5-26-19-18 26-4z"
       stroke="currentColor" stroke-width="2" opacity=".6"/>`,
    [CARD_CATEGORIES.TERRAIN]: `<path d="M12 78l22-30 16 18 14-22 24 34z" stroke="currentColor" stroke-width="2" opacity=".6"/>
       <path d="M12 86h96" stroke="currentColor" stroke-width="1.4" opacity=".4"/>`,
  };
  return svg(
    '0 0 120 96',
    `<rect x="1" y="1" width="118" height="94" rx="2" fill="none" stroke="currentColor" stroke-width="1" opacity=".35"/>
     ${motifs[card.category]}
     <text x="60" y="58" text-anchor="middle" font-family="Oswald, sans-serif" font-size="30"
           fill="currentColor" opacity=".28">${card.name[0]}</text>`
  );
}

/** Éclats de dissolution, pour l'animation de mort. */
export const DEATH_SHARDS = [
  'M0 0l6 3-4 5z',
  'M0 0l7-2-2 6z',
  'M0 0l-5 4 5 3z',
  'M0 0l4 6-6 1z',
  'M0 0l-6-3 3-4z',
  'M0 0l5-5 2 6z',
];
