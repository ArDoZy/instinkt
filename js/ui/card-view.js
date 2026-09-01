/**
 * La carte, composant unique : main, deckbuilding et animations partagent le
 * même rendu, ce qui garantit qu'une carte qui s'envole ressemble exactement à
 * celle qu'on vient de cliquer.
 */

import { CARD_CATEGORIES } from '../engine/index.js';
import { CARD_BACK, cardArt } from './assets.js';
import { el } from './dom.js';

export const CATEGORIE_LABEL = {
  [CARD_CATEGORIES.INSTINCT]: 'Instinct',
  [CARD_CATEGORIES.BUFF]: 'Buff',
  [CARD_CATEGORIES.TERRAIN]: 'Terrain',
};

/** Contenu d'une carte : coût en losange, médaillon, nom, texte de règle. */
export const cardFace = (card, { bande = false } = {}) => [
  el('span', { class: 'cout' }, card.cost),
  el('i', { class: 'medaillon', html: cardArt(card) }),
  el('span', { class: 'nom' }, card.name),
  el('span', { class: 'texte' }, card.text),
  bande ? el('span', { class: 'bande' }, CATEGORIE_LABEL[card.category]) : null,
];

/** Carte non interactive — sert aux animations. */
export const cardGhost = (card, className = '') =>
  el('div', { class: `carte fantome-carte ${className}`, dataCategorie: card.category }, ...cardFace(card));

/** Dos de carte. */
export const cardBack = (className = '') => el('div', { class: `dos ${className}`, html: CARD_BACK });
