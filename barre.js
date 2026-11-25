/* LE BOUT DE LA BARRE OLDA (21/11/2026, Charlie : « en haut de chaque app une
   roue dentée pour les réglages et une double flèche pour faire apparaître la
   page en grand ; sur chaque app on trouve les réglages au même endroit »).

   Chaque appli finit sa barre par la roue (`.ob-reglages`, ses propres
   réglages) puis la double flèche (`.ob-grand`). Ce fichier, source unique,
   donne vie à la double flèche :
   - dans le Dashboard, si l'appli est son planning (il répond { olda: 'hub' }),
     elle agrandit le cadre du Dashboard ;
   - ailleurs, elle met la page en plein écran (Échap ou la flèche la rend).
   Et, dans un cadre du Dashboard (25/11/2026, « un seul onglet ») : un lien
   « nouvel onglet » de l'appli ne fait plus naître une fenêtre ; le Dashboard
   l'ouvre dans l'onglet de l'appli visée (ou l'onglet du navigateur de ce site).
   Chargé par chaque appli : <script src="https://dockbearolda.github.io/barre.js" defer></script> */
(function () {
  if (window.__obBarre) return;
  window.__obBarre = true;
  var GRAND = '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>';
  var PETIT = '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>';
  var OK = /^(https:\/\/dockbearolda\.github\.io|https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
  var cadre = window.parent !== window;
  var dash = null, maxed = false;
  var doc = document, racine = doc.documentElement;

  function plein() { return !!(doc.fullscreenElement || doc.webkitFullscreenElement); }
  function possible() { return !!(dash || doc.fullscreenEnabled || doc.webkitFullscreenEnabled); }
  function maj() {
    var on = dash ? maxed : plein(), mot = on ? 'Réduire' : 'Agrandir';
    var boutons = doc.querySelectorAll('.ob-grand');
    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i], svg = b.querySelector('svg');
      b.hidden = !possible();
      b.setAttribute('aria-label', mot); b.title = mot;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (svg) svg.innerHTML = on ? PETIT : GRAND;
    }
  }
  doc.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('.ob-grand');
    if (!b) return;
    if (dash) { window.parent.postMessage({ olda: 'hub-grow' }, dash); return; }
    try {
      if (plein()) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      else (racine.requestFullscreen || racine.webkitRequestFullscreen).call(racine);
    } catch (_) {}
  });
  doc.addEventListener('fullscreenchange', maj);
  doc.addEventListener('webkitfullscreenchange', maj);
  addEventListener('message', function (e) {
    if (!cadre || e.source !== window.parent || !OK.test(e.origin) || !e.data || e.data.olda !== 'hub') return;
    dash = e.origin; maxed = !!e.data.maxed; maj();
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', maj); else maj();
  // Une appli posée plus tard (le Logo maker monte sa barre en JS) : on revoit au premier besoin.
  new MutationObserver(function () { if (doc.querySelector('.ob-grand:not([aria-pressed])')) maj(); })
    .observe(racine, { childList: true, subtree: true });
  // Le Dashboard autour (Chrome, Safari : location.ancestorOrigins ; sans, rien ne change).
  var autour = cadre && location.ancestorOrigins && location.ancestorOrigins[0];
  if (autour && OK.test(autour)) doc.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = null, chemin = e.composedPath ? e.composedPath() : [e.target];
    for (var i = 0; i < chemin.length && !a; i++) if (chemin[i].tagName === 'A' && chemin[i].href) a = chemin[i];
    if (!a || a.hasAttribute('download') || (a.getAttribute('target') || '').toLowerCase() !== '_blank') return;
    if (a.protocol !== 'https:' && a.protocol !== 'http:') return;
    e.preventDefault();
    window.parent.postMessage({ olda: 'ouvrir', url: a.href }, autour);
  });
  if (cadre) window.parent.postMessage({ olda: 'hub-ready' }, '*');
})();
