/** Helpers DOM minimalistes — la couche vue n'a besoin de rien de plus. */

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'style' && typeof value === 'object') applyStyle(node, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.startsWith('data')) node.dataset[key.slice(4).replace(/^./, (c) => c.toLowerCase())] = value;
    else if (key === 'aria') for (const [a, v] of Object.entries(value)) node.setAttribute(`aria-${a}`, v);
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Remplace les enfants d'un nœud en ignorant null/undefined/false —
 * `replaceChildren` les convertirait en texte « null ».
 */
export function setChildren(node, ...children) {
  node.replaceChildren(
    ...children.flat().filter((c) => c !== null && c !== undefined && c !== false)
  );
  return node;
}

/**
 * Applique un style. Les variables CSS doivent passer par setProperty :
 * `Object.assign(style, {'--x': 3})` est silencieusement ignoré.
 */
function applyStyle(node, style) {
  for (const [prop, value] of Object.entries(style)) {
    if (prop.startsWith('--')) node.style.setProperty(prop, value);
    else node.style[prop] = value;
  }
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Respecte prefers-reduced-motion : tout devient instantané (§7). */
export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Promesse résolue après `ms`, ou immédiatement si les animations sont coupées. */
export const wait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : ms));

/** Prochaine frame — pour laisser le navigateur appliquer une classe avant transition. */
export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
