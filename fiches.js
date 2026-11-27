/* LA FICHE D'UN CLIENT (27/11/2026, Charlie : « je tape un client, je vois instantanément
   ses projets, les liens envoyés, une petite coche verte s'il a validé — simple et efficace ;
   rangés textile puis Trotec »). Une seule fiche pour les trois recherches : le Dashboard (en
   haut), BAT Studio et Gabarits laser. Les données : BAT Studio /api/clients/fiches
   (server/fiches.mjs), qui lit aussi Gabarits laser.

   Chargé par chaque appli : <script src="https://dockbearolda.github.io/fiches.js" defer></script>
   window.oldaFiches :
     rendre(conteneur, q, { max, ouvrir })  la fiche des clients qui répondent à q (rien si q est vide) ;
                                             rend le nombre de clients montrés, se redessine quand les données arrivent
     barre(hote)                             le champ « Chercher un client » et son panneau (le Dashboard)
     precharger()                            lit les données sans attendre la frappe
   Les couleurs : olda.css (--ok, --warn, --danger, --muted…). */
(() => {
  if (window.oldaFiches) return;
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const myolda = /\.myolda\.com$/.test(location.hostname);
  const script = document.currentScript;
  // Comme bulle.js : sur myolda.com l'appli relaie /olda-bat/… à BAT Studio (même adresse, le cookie Access suit).
  const API = (script && script.dataset.bat) || (local && new URLSearchParams(location.search).get('bat'))
    || (location.hostname === 'bat.myolda.com' || local ? location.origin
      : myolda ? location.origin + '/olda-bat' : 'https://bat.myolda.com');

  // ---- les données : relues au plus toutes les 30 s, gardées pour un affichage immédiat ----
  const CLE = 'olda_fiches';
  let clients = null, lu = 0, enCours = null;
  const abonnes = new Set();
  try { const c = JSON.parse(sessionStorage.getItem(CLE) || 'null'); if (Array.isArray(c?.clients)) clients = c.clients; } catch (_) {}
  function charger(force) {
    if (enCours || (!force && Date.now() - lu < 30000)) return enCours;
    enCours = fetch(API + '/api/clients/fiches', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.clients)) {
          clients = j.clients; lu = Date.now();
          try { sessionStorage.setItem(CLE, JSON.stringify({ clients })); } catch (_) {}
          for (const f of abonnes) f();
        }
      })
      .catch(() => {})
      .finally(() => { enCours = null; });
    return enCours;
  }

  // ---- la recherche : le nom du client (espaces, accents, apostrophes ignorés), ou un projet ----
  const cle = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compact = (v) => cle(v).replace(/ /g, '');
  function chercher(q) {
    const k = cle(q), kc = compact(q);
    if (kc.length < 2 || !clients) return [];
    const rang = (f) => {
      const c = compact(f.client), mots = cle(f.client).split(' ');
      if (c === kc) return 0;
      if (c.startsWith(kc)) return 1;
      if (mots.some((m) => m.startsWith(k.split(' ')[0])) && c.includes(kc)) return 2;
      if (c.includes(kc)) return 3;
      if ([...f.textile, ...f.trotec].some((l) => cle(l.projet).includes(k))) return 4;
      return -1;
    };
    return clients.map((f) => [rang(f), f]).filter(([r]) => r >= 0)
      .sort((a, b) => a[0] - b[0] || String(b[1].maj || '').localeCompare(String(a[1].maj || ''))).map(([, f]) => f);
  }

  // ---- le dessin ----
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jour = (iso) => { const d = new Date(iso || ''); return Number.isNaN(d.getTime()) || !iso ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const I = {
    valide: '<path d="M20 6 9 17l-5-5"/>',
    attente: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    modif: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5"/><path d="M12 16h.01"/>',
    brouillon: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    copier: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    ouvrir: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  };
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const MOT = { valide: 'Validé', attente: 'Attente du client', modif: 'À modifier', brouillon: 'Brouillon' };
  function meta(l, cote) {
    const out = [];
    if (cote === 'trotec' && l.detail) out.push(l.detail);
    if (l.etat === 'brouillon') out.push('pas encore envoyé');
    else if (l.envoyeLe) out.push(`${cote === 'textile' && l.version ? 'v' + l.version + ' ' : ''}envoyé le ${jour(l.envoyeLe)}`);
    if (l.etat === 'valide' && l.valideLe) out.push(`validé${l.par ? ' par ' + l.par : ''} le ${jour(l.valideLe)}`);
    if (l.note) out.push(`« ${l.note} »`);
    return out.join(' · ');
  }
  const sur = (u) => (/^https?:\/\//.test(String(u || '')) ? u : '');
  function ligne(l, cote) {
    l = { ...l, lien: sur(l.lien), ouvrir: sur(l.ouvrir) };
    return `<div class="ofi-ligne" data-etat="${esc(l.etat)}">
      <span class="ofi-ic">${svg(I[l.etat] || I.attente)}</span>
      <span class="ofi-txt"><b>${esc(l.projet)}</b><small>${esc(meta(l, cote))}</small></span>
      <span class="ofi-pil">${MOT[l.etat] || ''}</span>
      ${l.lien ? `<button type="button" class="ofi-bt" data-copier="${esc(l.lien)}" aria-label="Copier le lien envoyé au client" title="Copier le lien envoyé au client">${svg(I.copier)}</button>` : '<span class="ofi-bt ofi-vide" aria-hidden="true"></span>'}
      ${l.ouvrir ? `<a class="ofi-bt" href="${esc(l.ouvrir)}" target="_blank" rel="noopener" data-ouvrir aria-label="Ouvrir" title="Ouvrir">${svg(I.ouvrir)}</a>` : '<span class="ofi-bt ofi-vide" aria-hidden="true"></span>'}
    </div>`;
  }
  const MAX_LIGNES = 6;
  function section(f, cote, titre) {
    const l = f[cote];
    if (!l.length) return '';
    const plus = l.length - MAX_LIGNES;
    return `<div class="ofi-sec"><h3>${titre}</h3>${l.slice(0, MAX_LIGNES).map((x) => ligne(x, cote)).join('')}
      ${plus > 0 ? `<div class="ofi-reste" hidden>${l.slice(MAX_LIGNES).map((x) => ligne(x, cote)).join('')}</div><button type="button" class="ofi-plus" data-plus>${plus} de plus</button>` : ''}</div>`;
  }
  function fiche(f) {
    const n = f.textile.length + f.trotec.length;
    return `<article class="ofi-fiche">
      <header><h2>${esc(f.client)}</h2>${f.ok ? `<span class="ofi-ok" title="Tout ce qui est parti chez lui est validé">${svg(I.valide)}</span>` : ''}
        <small>${n} projet${n > 1 ? 's' : ''}</small></header>
      ${section(f, 'textile', 'Textile')}${section(f, 'trotec', 'Trotec')}
    </article>`;
  }

  // ---- le geste ----
  async function copier(bouton) {
    const t = bouton.dataset.copier;
    try { await navigator.clipboard.writeText(t); }
    catch (_) { window.prompt('Le lien du client :', t); return; }
    bouton.classList.add('ofi-copie');
    bouton.innerHTML = svg(I.valide);
    setTimeout(() => { bouton.classList.remove('ofi-copie'); bouton.innerHTML = svg(I.copier); }, 1500);
  }
  function ouvrirParDefaut(url) {
    if (window.oldaOuvrir) return window.oldaOuvrir(url);
    try { if (new URL(url).origin === location.origin) { location.assign(url); return; } } catch (_) { return; }
    window.open(url, '_blank', 'noopener');
  }
  function brancher(conteneur, ouvrir) {
    if (conteneur.__ofi) return;
    conteneur.__ofi = true;
    conteneur.addEventListener('click', (e) => {
      const c = e.target.closest('[data-copier]');
      if (c) { e.preventDefault(); copier(c); return; }
      const p = e.target.closest('[data-plus]');
      if (p) { p.previousElementSibling.hidden = false; p.remove(); return; }
      const a = e.target.closest('a[data-ouvrir]');
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); (conteneur.__ouvrir || ouvrirParDefaut)(a.href); }
    });
  }

  const MAX_CLIENTS = 5;
  function rendre(conteneur, q, opts = {}) {
    styler();
    brancher(conteneur, opts.ouvrir);
    if (opts.ouvrir) conteneur.__ouvrir = opts.ouvrir;
    const dessiner = () => {
      const trouves = chercher(q).slice(0, opts.max || MAX_CLIENTS);
      conteneur.innerHTML = trouves.length ? `<div class="ofi">${trouves.map(fiche).join('')}</div>`
        : compact(q).length >= 2 && !clients ? '<p class="ofi-attente">Chargement des clients…</p>' : '';
      return trouves.length;
    };
    // Les données changent (relues) : la même recherche se redessine, si elle est toujours là.
    if (conteneur.__ofiAbo) abonnes.delete(conteneur.__ofiAbo);
    conteneur.__ofiAbo = () => { if (conteneur.isConnected && conteneur.__ofiQ === q) dessiner(); };
    conteneur.__ofiQ = q;
    abonnes.add(conteneur.__ofiAbo);
    if (compact(q).length >= 2) charger();
    return dessiner();
  }

  // ---- le champ du Dashboard : la fiche s'ouvre dessous, par-dessus le reste ----
  function barre(hote) {
    styler();
    hote.classList.add('ofi-barre');
    hote.innerHTML = `<label class="ofi-champ">${svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>')}
      <input type="search" placeholder="Chercher un client" autocomplete="off" spellcheck="false" enterkeyhint="search" aria-label="Chercher un client"></label>
      <div class="ofi-panneau" hidden></div>`;
    const champ = hote.querySelector('input'), panneau = hote.querySelector('.ofi-panneau');
    const maj = () => {
      const q = champ.value;
      const n = rendre(panneau, q, { max: 4 });
      panneau.hidden = compact(q).length < 2;
      if (!n && !panneau.hidden && clients) panneau.innerHTML = '<p class="ofi-attente">Aucun client à ce nom.</p>';
    };
    champ.addEventListener('input', maj);
    champ.addEventListener('focus', () => { charger(); if (champ.value) maj(); });
    champ.addEventListener('keydown', (e) => { if (e.key === 'Escape') { champ.value = ''; maj(); champ.blur(); } });
    document.addEventListener('pointerdown', (e) => { if (!hote.contains(e.target)) panneau.hidden = true; });
    abonnes.add(() => { if (!panneau.hidden) maj(); });
    return champ;
  }

  let style = null;
  function styler() {
    if (style) return;
    style = document.createElement('style');
    style.id = 'olda-fiches';
    style.textContent = `
.ofi{display:flex;flex-direction:column;gap:12px;font-family:var(--font,Inter,system-ui,sans-serif);color:var(--ink,#202930)}
.ofi-fiche{background:var(--surface,#fff);border:1px solid var(--line-soft,#e4e9ed);border-radius:var(--radius-champ,12px);padding:14px 16px 6px}
.ofi-fiche header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.ofi-fiche h2{margin:0;font-size:17px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.ofi-fiche header small{margin-left:auto;color:var(--muted,#5b6b78);font-size:13px;white-space:nowrap}
.ofi-ok{display:inline-flex;width:22px;height:22px;border-radius:50%;background:var(--ok,#137333);color:#fff;align-items:center;justify-content:center;flex:none}
.ofi-ok svg{width:14px;height:14px;stroke:currentColor;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ofi-sec h3{margin:10px 0 0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--faint,#7d8b96)}
.ofi-ligne{display:flex;align-items:center;gap:10px;min-height:52px;padding:4px 0;border-top:1px solid var(--line-soft,#e4e9ed)}
.ofi-sec h3+.ofi-ligne{border-top:0}
.ofi-ic{flex:none;display:inline-flex;width:20px;justify-content:center;color:var(--faint,#7d8b96)}
.ofi-ic svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ofi-ligne[data-etat=valide] .ofi-ic{color:var(--ok,#137333)}
.ofi-ligne[data-etat=attente] .ofi-ic{color:var(--warn,#b45309)}
.ofi-ligne[data-etat=modif] .ofi-ic{color:var(--danger,#d93025)}
.ofi-txt{flex:1;min-width:0;display:flex;flex-direction:column}
.ofi-txt b{font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ofi-txt small{font-size:13px;color:var(--muted,#5b6b78);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ofi-pil{flex:none;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap;background:var(--duck-voile,rgba(74,98,116,.08));color:var(--muted,#5b6b78)}
.ofi-ligne[data-etat=valide] .ofi-pil{background:var(--ok-bg,#e6f4ea);color:var(--ok,#137333)}
.ofi-ligne[data-etat=attente] .ofi-pil{background:var(--warn-bg,#fdf3e5);color:var(--warn,#b45309)}
.ofi-ligne[data-etat=modif] .ofi-pil{background:var(--danger-bg,#fce8e6);color:var(--danger,#d93025)}
.ofi-bt{flex:none;width:44px;height:44px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:var(--radius-champ,12px);background:transparent;color:var(--muted,#5b6b78);cursor:pointer;text-decoration:none}
.ofi-bt:hover{background:var(--hover,rgba(74,98,116,.07));color:var(--ink,#202930)}
.ofi-bt:focus-visible{outline:none;box-shadow:var(--ring,0 0 0 3px rgba(107,129,145,.45))}
.ofi-bt svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
.ofi-bt.ofi-copie{color:var(--ok,#137333)}
.ofi-vide{visibility:hidden;cursor:default}
.ofi-plus{display:block;width:100%;min-height:44px;border:0;border-top:1px solid var(--line-soft,#e4e9ed);background:none;color:var(--muted,#5b6b78);font:inherit;font-size:13px;cursor:pointer}
.ofi-plus:hover{color:var(--ink,#202930)}
.ofi-attente{margin:8px 4px;color:var(--muted,#5b6b78);font-size:14px}
.ofi-barre{position:relative;font-family:var(--font,Inter,system-ui,sans-serif)}
.ofi-champ{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-radius:999px;background:var(--glass-strong,rgba(255,255,255,.78));border:1px solid var(--card-border,rgba(255,255,255,.7));box-shadow:var(--shadow);cursor:text}
.ofi-champ:focus-within{box-shadow:var(--ring,0 0 0 3px rgba(107,129,145,.45)),var(--shadow)}
.ofi-champ svg{width:18px;height:18px;flex:none;stroke:var(--faint,#7d8b96);stroke-width:2;fill:none;stroke-linecap:round}
.ofi-champ input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:16px;color:var(--ink,#202930)}
.ofi-panneau{position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:40;max-height:min(70vh,720px);overflow:auto;overscroll-behavior:contain;padding:10px;border-radius:var(--radius,22px);background:var(--glass-strong,rgba(255,255,255,.92));-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);border:1px solid var(--card-border,rgba(255,255,255,.7));box-shadow:var(--shadow-pop,0 24px 60px rgba(32,41,48,.28))}
@media (max-width:520px){.ofi-pil{display:none}}
`;
    document.head.appendChild(style);
  }

  window.oldaFiches = { rendre, barre, precharger: () => charger(), chercher };
})();
