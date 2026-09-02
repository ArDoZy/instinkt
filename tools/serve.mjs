/**
 * Serveur statique de développement, sans dépendance.
 *
 * Il sert la racine du dépôt et, si le port demandé est déjà pris, essaie le
 * suivant plutôt que de planter : rouvrir un terminal sans avoir fermé le
 * précédent ne doit pas coûter une session de débogage.
 *
 *   node tools/serve.mjs [port]      PORT=3000 node tools/serve.mjs
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT_DEMANDE = Number(process.argv[2] ?? process.env.PORT ?? 8000);
/** Nombre de ports consécutifs essayés avant d'abandonner. */
const ESSAIS = 20;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Chemin disque correspondant à une URL, ou null s'il sort de la racine. */
function cheminDe(url) {
  const chemin = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  const cible = resolve(RACINE, '.' + normalize(chemin));
  // Un `..` dans l'URL ne doit jamais permettre de sortir du dépôt.
  return cible === RACINE || cible.startsWith(RACINE + sep) ? cible : null;
}

const serveur = createServer(async (req, res) => {
  const base = cheminDe(req.url);
  if (!base) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('403 — hors du dépôt');
  }

  let fichier = base;
  try {
    const infos = await stat(fichier);
    if (infos.isDirectory()) fichier = join(fichier, 'index.html');
    await stat(fichier);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404 — ' + req.url);
  }

  res.writeHead(200, {
    'content-type': TYPES[extname(fichier)] ?? 'application/octet-stream',
    // Le développement doit refléter le disque, jamais un cache.
    'cache-control': 'no-store',
  });
  createReadStream(fichier).pipe(res);
});

// Un seul point d'annonce : `listen(port, host, cb)` empile un écouteur à
// chaque tentative, et les tentatives ratées parleraient elles aussi.
serveur.on('listening', () => {
  console.log(`Instynkt sert ${RACINE}`);
  console.log(`  → http://localhost:${serveur.address().port}/`);
  console.log('  Ctrl+C pour arrêter.');
});

/** Écoute sur `port`, ou sur le premier port libre au-dessus. */
function ecouter(port, restants) {
  serveur.once('error', (erreur) => {
    if (erreur.code !== 'EADDRINUSE' || restants === 0) throw erreur;
    console.log(`Port ${port} déjà utilisé, on essaie ${port + 1}…`);
    ecouter(port + 1, restants - 1);
  });
  serveur.listen(port, '0.0.0.0');
}

ecouter(PORT_DEMANDE, ESSAIS);
