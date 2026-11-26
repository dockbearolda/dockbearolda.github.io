/* Les messages OLDA : le même toast et la même fenêtre de confirmation dans toutes les applis
 * (Dashboard, planning, BAT Studio, Stock textile). Une ligne suffit pour les poser :
 *
 *   <script src="https://dockbearolda.github.io/messages.js"></script>
 *
 * Source unique : ce fichier, dans le dépôt du Dashboard (comme bulle.js et barre.js).
 * Tout vit dans un Shadow DOM : les styles de l'appli n'y entrent pas, rien n'en sort.
 *
 *   oldaMessages.toast(texte, { action: { label, onClick }, erreur, ms, onFermer })   → { fermer() }
 *       ms : 3 s par défaut, 6 s avec une action ou une erreur, 0 = reste jusqu'à la croix (onFermer).
 *   oldaMessages.confirmer({ titre, texte, ok, annuler, danger })          → Promise<boolean>
 *   oldaMessages.choisir({ titre, texte, choix: [{ label, valeur, principal }], annuler })  → valeur | null
 *   oldaMessages.ouverte()  → true quand une fenêtre commune est à l'écran
 *   oldaMessages.demander({ titre, texte, champs: [{ nom, label, type, options, valeur }], ok })
 *       type : 'texte' | 'nombre' | 'choix' (options = liste)              → Promise<{…} | null>
 *
 * Les toasts paraissent EN HAUT, au centre, dans toutes les applis (22/11/2026, Charlie : en bas
 * ils gênaient). Réglages par l'appli (variables CSS sur :root) : --olda-message-haut (écart au
 * bord haut), --olda-message-x (son centre). Toujours clair (pas de mode nuit).
 */
(() => {
  if (window.oldaMessages) return;

  const CSS = `
  :host{ all:initial; }
  *{ box-sizing:border-box; margin:0; padding:0; -webkit-font-smoothing:antialiased; }
  .racine{
    --encre:#202930; --encre-2:#5b6b78; --filet:#d6dde3; --surface:#fff; --survol:#f1f4f6;
    --ardoise:#4A6274; --ardoise-survol:#42596A; --focus:rgba(107,129,145,.45); --rouge:#d93025;
    --ressort:cubic-bezier(.34,1.56,.64,1);
    font-family:'Inter','Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;
    font-variant-numeric:tabular-nums; color:var(--encre);
  }
  button,input,select{ font:inherit; color:inherit; }
  button{ cursor:pointer; -webkit-tap-highlight-color:transparent; }

  /* ---------- Le toast : la pilule d'encre du Dashboard ---------- */
  .pile{ position:fixed; z-index:2147483000; left:var(--olda-message-x,50%); transform:translateX(-50%);
    top:calc(var(--olda-message-haut,12px) + env(safe-area-inset-top,0px));
    display:flex; flex-direction:column; align-items:center; gap:8px; width:max-content; max-width:calc(100vw - 32px); pointer-events:none; }
  .toast{ display:flex; align-items:center; gap:4px; max-width:100%; min-height:48px; padding:4px 4px 4px 18px;
    border-radius:16px; background:#202930; color:#fff; font-size:14px; font-weight:500; line-height:1.35;
    box-shadow:0 12px 30px rgba(32,41,48,.3); pointer-events:auto;
    opacity:0; transform:translateY(-16px); transition:opacity .25s, transform .35s var(--ressort); }
  .toast.on{ opacity:1; transform:none; }
  .toast .txt{ padding:10px 14px 10px 0; }
  .toast.seul .txt{ padding-right:14px; }
  .toast.erreur::before{ content:""; flex:none; width:8px; height:8px; margin:0 10px 0 -4px; border-radius:50%; background:#f28b82; }
  .toast .act{ flex:none; min-height:40px; padding:0 14px; border:0; border-radius:12px; background:none; color:#9fd0ff; font-weight:700; white-space:nowrap; }
  .toast .x{ flex:none; width:40px; height:40px; border:0; border-radius:50%; background:none; color:#fff; display:grid; place-items:center; opacity:.75; }
  .toast :is(.act,.x):hover{ background:rgba(255,255,255,.1); opacity:1; }
  .toast :is(.act,.x):focus-visible{ outline:3px solid rgba(159,208,255,.6); outline-offset:-2px; }
  .x svg,.fermer svg{ width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; }

  /* ---------- La fenêtre : la feuille du Dashboard ---------- */
  dialog{ border:0; padding:0; margin:auto; background:var(--surface); color:var(--encre);
    width:min(440px, calc(100% - 32px)); max-height:calc(100dvh - 32px);
    border-radius:24px; box-shadow:0 24px 60px rgba(32,41,48,.28); overflow:hidden; }
  dialog[open]{ display:flex; flex-direction:column; animation:entre .35s var(--ressort); }
  dialog::backdrop{ background:rgba(32,41,48,.36); }
  @keyframes entre{ from{ opacity:0; transform:translateY(24px) scale(.98); } }
  @media (max-width:560px){
    dialog{ width:100%; max-width:100%; margin:auto 0 0; border-radius:24px 24px 0 0; max-height:92dvh; }
    @keyframes entre{ from{ transform:translateY(100%); } }
  }
  form{ display:flex; flex-direction:column; min-height:0; }
  .tete{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 8px 4px 20px; }
  .tete h2{ font-size:17px; font-weight:700; line-height:1.3; }
  .fermer{ flex:none; width:44px; height:44px; border:0; border-radius:50%; background:none; color:var(--encre-2); display:grid; place-items:center; }
  .fermer:hover{ background:var(--survol); }
  .corps{ overflow-y:auto; overscroll-behavior:contain; padding:4px 20px 20px; display:grid; gap:16px; }
  .corps p{ font-size:15px; line-height:1.5; color:var(--encre-2); white-space:pre-line; }
  .champ{ display:grid; gap:6px; }
  .champ span{ font-size:14px; font-weight:600; color:#7d8b96; }   /* l'intitulé de BAT Studio */
  .champ :is(input,select){ width:100%; height:44px; padding:0 12px; font-size:16px; border-radius:12px;
    border:1px solid var(--filet); background:var(--surface); transition:border-color .2s, box-shadow .2s; }
  .champ :is(input,select):focus{ outline:none; border-color:#6B8191; box-shadow:0 0 0 3px rgba(107,129,145,.22); }
  .pied{ display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; padding:12px 20px calc(12px + env(safe-area-inset-bottom,0px)); border-top:1px solid var(--filet); }
  .btn{ min-height:44px; padding:0 18px; border-radius:999px; border:1px solid transparent;
    display:inline-flex; align-items:center; justify-content:center; font-size:15px; font-weight:600; white-space:nowrap;
    transition:background-color .2s, transform .2s var(--ressort); }
  .btn:active{ transform:scale(.96); }
  .btn:focus-visible,.fermer:focus-visible{ outline:3px solid var(--focus); outline-offset:2px; }
  .btn.principal{ background:var(--ardoise); color:#fff; }
  .btn.principal:hover{ background:var(--ardoise-survol); }
  .btn.principal.danger{ background:var(--rouge); }
  .btn.principal.danger:hover{ filter:brightness(1.08); }
  .btn.second{ background:transparent; color:var(--ardoise); border-color:var(--filet); }
  .btn.second:hover{ background:var(--survol); }
  @media (prefers-reduced-motion:reduce){ .toast,dialog[open]{ transition:none; animation:none; } }
  `;
  const CROIX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  let racine = null, pile = null;
  function monter(){
    if (racine) return;
    const hote = document.createElement('olda-messages');
    const sh = hote.attachShadow({ mode: 'open' });
    sh.innerHTML = `<style>${CSS}</style><div class="racine"><div class="pile" role="status" aria-live="polite"></div></div>`;
    racine = sh.querySelector('.racine'); pile = sh.querySelector('.pile');
    (document.body || document.documentElement).appendChild(hote);
  }
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  // Trois messages au plus à l'écran : le plus ancien laisse sa place.
  function toast(texte, { action = null, erreur = false, ms, onFermer = null } = {}){
    monter();
    const t = el('div', 'toast' + (erreur ? ' erreur' : ''));
    t.setAttribute('role', erreur ? 'alert' : 'status');
    t.append(el('span', 'txt', texte));
    let minuterie = null;
    const fermer = () => { clearTimeout(minuterie); t.classList.remove('on'); setTimeout(() => t.remove(), 300); };
    if (action) {
      const b = el('button', 'act', action.label); b.type = 'button';
      b.onclick = () => { fermer(); action.onClick?.(); };
      t.append(b);
    }
    const duree = ms ?? (action ? 6000 : erreur ? 6000 : 3000);
    if (duree === 0) {
      const x = el('button', 'x'); x.type = 'button'; x.innerHTML = CROIX; x.setAttribute('aria-label', 'Fermer');
      x.onclick = () => { fermer(); onFermer?.(); }; t.append(x);
    }
    if (!action && duree !== 0) t.classList.add('seul');
    while (pile.children.length >= 3) pile.firstElementChild.remove();
    pile.append(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on')));
    if (duree > 0) minuterie = setTimeout(fermer, duree);
    return { fermer };
  }

  // Une fenêtre : titre, texte, champs éventuels, « Annuler » + le bouton principal.
  function fenetre({ titre = '', texte = '', champs = [], ok = 'Confirmer', annuler = 'Annuler', danger = false, choix = null }){
    monter();
    return new Promise(resoudre => {
      const d = el('dialog'); d.setAttribute('aria-label', titre || texte);
      const f = el('form'); f.method = 'dialog'; f.noValidate = true;
      const tete = el('header', 'tete'); tete.append(el('h2', '', titre));
      const x = el('button', 'fermer'); x.type = 'button'; x.innerHTML = CROIX; x.setAttribute('aria-label', 'Fermer');
      tete.append(x);
      const corps = el('div', 'corps');
      if (texte) corps.append(el('p', '', texte));
      const entrees = champs.map(c => {
        const l = el('label', 'champ'); l.append(el('span', '', c.label || ''));
        let i;
        if (c.type === 'choix') {
          i = el('select');
          for (const o of c.options || []) { const opt = el('option', '', String(o)); opt.value = String(o); i.append(opt); }
          if (c.valeur != null) i.value = String(c.valeur);
        } else {
          i = el('input'); i.autocomplete = 'off'; i.spellcheck = false;
          if (c.type === 'nombre') { i.inputMode = 'numeric'; i.pattern = '[0-9]*'; i.oninput = () => { i.value = i.value.replace(/\D/g, '').slice(0, 6); }; }
          if (c.valeur != null) i.value = String(c.valeur);
          if (c.placeholder) i.placeholder = c.placeholder;
        }
        i.name = c.nom; l.append(i); corps.append(l);
        return [c, i];
      });
      const pied = el('footer', 'pied');
      const non = el('button', 'btn second', annuler); non.type = 'button';
      const oui = el('button', 'btn principal' + (danger ? ' danger' : ''), ok); oui.type = 'submit';
      // Plusieurs réponses (choisir) : chacune son bouton, la principale en ardoise.
      const boutons = (choix || []).map(c => { const b = el('button', 'btn ' + (c.principal ? 'principal' : 'second'), c.label); b.type = 'button'; b.onclick = () => finir(c.valeur); return b; });
      pied.append(non, ...(choix ? boutons : [oui]));
      f.append(tete, corps, pied); d.append(f);
      racine.append(d);
      let rendu = false;
      const finir = v => { if (rendu) return; rendu = true; d.close(); d.remove(); resoudre(v); };
      const rien = champs.length || choix ? null : false;
      x.onclick = non.onclick = () => finir(rien);
      d.addEventListener('cancel', e => { e.preventDefault(); finir(rien); });
      d.addEventListener('click', e => { if (e.target === d) finir(rien); });
      f.onsubmit = e => {
        e.preventDefault();
        if (!champs.length) return finir(true);
        const v = {};
        for (const [c, i] of entrees) {
          const brut = i.value.trim();
          if (c.requis !== false && !brut) { i.focus(); return; }
          v[c.nom] = c.type === 'nombre' ? Number(brut) : brut;
        }
        finir(v);
      };
      d.showModal();
      // Détruire demande un geste visé : le focus va sur « Annuler ». Un champ, lui, prend le focus.
      (entrees[0]?.[1] || (choix ? boutons.find(b => b.classList.contains('principal')) || boutons[0] : danger ? non : oui)).focus();
    });
  }

  window.oldaMessages = {
    toast,
    // Une fenêtre commune est ouverte : l'appli laisse passer Échap et Tab (ses propres modales dessous).
    ouverte: () => !!racine?.querySelector('dialog[open]'),
    confirmer: o => fenetre(o),
    demander: o => fenetre({ ok: 'Valider', ...o }),
    // Plusieurs réponses : choix = [{ label, valeur, principal }] → la valeur, ou null (Plus tard, Échap).
    choisir: o => fenetre({ annuler: 'Plus tard', ...o, choix: o.choix || [] })
  };
})();
