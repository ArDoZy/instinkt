/**
 * PRNG seedé (mulberry32).
 *
 * L'état du générateur est un objet JSON simple stocké dans le state de la
 * partie : toute la partie est donc rejouable à l'identique à partir de la
 * graine. Aucune fonction du moteur n'appelle Math.random().
 */

/** @typedef {{ seed:number, s:number, calls:number }} Rng */

/** Crée un état de PRNG à partir d'une graine 32 bits. */
export function createRng(seed) {
  const s = (seed >>> 0) || 1;
  return { seed: s, s, calls: 0 };
}

/** Nombre flottant dans [0, 1). Mute l'état du PRNG passé en argument. */
export function rngFloat(rng) {
  let a = (rng.s + 0x6d2b79f5) >>> 0;
  rng.s = a;
  rng.calls++;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entier dans [0, n). */
export function rngInt(rng, n) {
  return Math.floor(rngFloat(rng) * n);
}

/** Entier dans [min, max] inclus. */
export function rngRange(rng, min, max) {
  return min + rngInt(rng, max - min + 1);
}

/** Élément aléatoire d'un tableau non vide. */
export function rngPick(rng, arr) {
  return arr[rngInt(rng, arr.length)];
}

/** Tirage pondéré : entries = [[valeur, poids], ...]. */
export function rngWeighted(rng, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rngFloat(rng) * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** Fisher-Yates en place, déterministe. */
export function rngShuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rngInt(rng, i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** Graine « aléatoire » — seul point d'entrée autorisé à Math.random(). */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
