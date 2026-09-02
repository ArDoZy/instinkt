/**
 * Modèle d'effets — données pures, sans logique de créature.
 *
 * Un effet porté par une créature : { kind, caster, remaining, ... }.
 *   `caster`    : joueur qui l'a lancé ; c'est la fin de SA manche qui décrémente.
 *   `remaining` : nombre de manches restantes, ou null pour un effet permanent.
 *
 * Un effet global vit dans `state.globalEffects` et mémorise la liste des
 * créatures présentes au lancement (§6.9) : une créature invoquée après n'en
 * bénéficie ni n'en souffre.
 */

/** Effets portés par une créature. */
export const EFFECTS = /** @type {const} */ ({
  FRENESIE: 'frenesie',
  CARAPACE: 'carapace',
  /** Changement d'instinct temporaire (Panique Collective). */
  PANIQUE: 'panique',
  /** Traque imposée (Obsession) : permanente jusqu'à la mort de la cible. */
  OBSESSION: 'obsession',
});

/** Effets globaux. */
export const GLOBALS = /** @type {const} */ ({
  LUNE_DE_SANG: 'luneDeSang',
  BROUILLARD: 'brouillardEpais',
  ECAILLE_DE_PIERRE: 'ecailleDePierre',
});

export const getEffect = (creature, kind) => creature.effects.find((e) => e.kind === kind) ?? null;
export const hasEffect = (creature, kind) => getEffect(creature, kind) !== null;

export function removeEffect(creature, kind) {
  const i = creature.effects.findIndex((e) => e.kind === kind);
  return i === -1 ? null : creature.effects.splice(i, 1)[0];
}

/**
 * Ajoute un effet. Deux exemplaires du même effet ne s'empilent pas : la durée
 * est rafraîchie (§6.6).
 */
export function addEffect(creature, effect) {
  const existing = getEffect(creature, effect.kind);
  if (existing) {
    existing.remaining = effect.remaining;
    existing.caster = effect.caster;
    return existing;
  }
  creature.effects.push(effect);
  return effect;
}

/**
 * Décrémente les effets lancés par `playerId` et retire ceux qui expirent.
 * @returns {object[]} les effets expirés, à traiter par l'appelant.
 */
export function tickCreatureEffects(creature, playerId) {
  const expired = [];
  creature.effects = creature.effects.filter((e) => {
    if (e.caster !== playerId || e.remaining === null) return true;
    e.remaining -= 1;
    if (e.remaining > 0) return true;
    expired.push(e);
    return false;
  });
  return expired;
}

/** Même décompte pour les effets globaux. */
export function tickGlobalEffects(state, playerId) {
  const expired = [];
  state.globalEffects = state.globalEffects.filter((e) => {
    if (e.caster !== playerId || e.remaining === null) return true;
    e.remaining -= 1;
    if (e.remaining > 0) return true;
    expired.push(e);
    return false;
  });
  return expired;
}

/**
 * Effet global d'un type donné s'appliquant à cette créature — c'est-à-dire
 * présente sur le plateau au moment du lancement (§6.9).
 */
export function globalFor(state, kind, creature) {
  return (
    state.globalEffects.find((e) => e.kind === kind && e.creatureIds.includes(creature.id)) ?? null
  );
}

/** Leurre adverse actif, ou null. */
export function enemyLure(state, creature) {
  const lure = state.players[1 - creature.owner].lure;
  return lure && lure.remaining > 0 ? lure : null;
}
