/* La bulle de discussion de l'équipe OLDA : une ligne suffit pour la poser dans n'importe quelle appli.
 *
 *   <script src="https://dockbearolda.github.io/bulle.js" defer></script>
 *
 * Elle flotte au-dessus de l'appli, dans son propre Shadow DOM (ni ses styles ni ses raccourcis
 * clavier ne fuient dans l'appli, et inversement). Les messages passent par BAT Studio (/api/chat,
 * WebSocket /api/chat/ws). Qui écrit : le prénom choisi sur l'appareil (pas de PIN, choix assumé) ;
 * retenu par appli (localStorage « olda_poste »), repris de « ?poste= » ou du poste de BAT Studio.
 * Dans un cadre (le planning dans le Dashboard), elle ne se pose pas : la page autour a déjà la sienne.
 *
 * Options sur la balise <script> :
 *   data-dashboard      le Dashboard choisit lui-même qui est au poste, puis appelle oldaBulle.relancer()
 *   data-bat="https://…" un autre BAT Studio (essais) ; en local, « ?bat=http://localhost:3101 » marche aussi
 * Source unique : ce fichier, dans le dépôt du Dashboard (dockbearolda.github.io).
 */
(() => {
  let cadre = false; try { cadre = window.top !== window.self; } catch (_) { cadre = true; }
  if (cadre || window.oldaBulle) return;
  const script = document.currentScript;
  const DASHBOARD = !!script && script.hasAttribute('data-dashboard');
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const BAT = (script && script.dataset.bat) || (local && new URLSearchParams(location.search).get('bat')) || 'https://bat-studio.dockbear.workers.dev';

  // --- Qui est au poste (les mêmes que le Dashboard ; chacun sa couleur) ---
  const PROFILES = [
    { id: 'loic',    name: 'Loïc',    tint: '217,48,37' },
    { id: 'charlie', name: 'Charlie', tint: '26,115,232' },
    { id: 'melina',  name: 'Mélina',  tint: '214,51,132' },
    { id: 'julien',  name: 'Julien',  tint: '245,158,11' }
  ];
  const LS_WHO = 'olda_poste';
  const store = {
    get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch(_) { return null; } },
    set(k,v){ try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch(_) {} },
    del(k){ try { localStorage.removeItem(k); } catch(_) {} },
    raw(k){ try { return localStorage.getItem(k); } catch(_) { return null; } }
  };
  const profil = id => PROFILES.find(p => p.id === id);
  // Le Dashboard ouvre parfois une appli avec « ?poste=julien » ; BAT Studio retient son poste sous « bat.poste ».
  if (!DASHBOARD) {
    let v = null; try { v = new URLSearchParams(location.search).get('poste'); } catch (_) {}
    if (profil(v)) store.set(LS_WHO, v);
    else if (!profil(store.raw(LS_WHO)) && profil(store.raw('bat.poste'))) store.set(LS_WHO, store.raw('bat.poste'));
  }
  const me = () => profil(store.raw(LS_WHO));

  // --- La bulle vit dans son Shadow DOM, au-dessus de tout ---
  const hote = document.createElement('olda-bulle');
  const root = hote.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
  :host{ all:initial; position:fixed; left:0; top:0; width:0; height:0; z-index:2147483000; }
  .chat, .todo, .ctx, .rappel, dialog, .toast{
    --duck:#4A6274; --duck-hover:#42596A; --duck-focus:#6B8191;
    --ink:#202930; --muted:#5b6b78; --line:#d6dde3; --danger:#d93025;
    --spring:cubic-bezier(.34,1.56,.64,1); --safe-b:env(safe-area-inset-bottom,0px);
    font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:16px; line-height:normal; color:var(--ink); font-variant-numeric:tabular-nums; text-align:left;
  }
  *{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  [hidden]{ display:none !important; }
  button,input,textarea{ font:inherit; color:inherit; }
  button{ cursor:pointer; -webkit-tap-highlight-color:transparent; }
  .avatar{
    --a:66,133,244; width:64px; height:64px; border-radius:50%; flex-shrink:0;
    display:grid; place-items:center; font-size:26px; font-weight:650; letter-spacing:-.01em;
    color:rgb(var(--a)); background:rgba(var(--a),.14); box-shadow:inset 0 0 0 1px rgba(var(--a),.22);
  }
  dialog{
    border:0; padding:0; margin:auto; background:#fff; color:var(--ink);
    width:min(440px, calc(100% - 32px)); max-height:calc(100dvh - 32px);
    border-radius:24px; box-shadow:0 24px 60px rgba(32,41,48,.28); overflow:hidden;
  }
  dialog[open]{ display:flex; flex-direction:column; animation:sheetIn .35s var(--spring); }
  dialog::backdrop{ background:rgba(32,41,48,.36); }
  @keyframes sheetIn{ from{ opacity:0; transform:translateY(24px) scale(.98); } }
  .toast{
    position:fixed; left:50%; bottom:calc(24px + var(--safe-b)); transform:translate(-50%,16px);
    display:flex; align-items:center; max-width:calc(100vw - 32px); width:max-content;
    padding:12px 18px; min-height:48px; border-radius:16px;
    background:var(--ink); color:#fff; font-size:14px; box-shadow:0 12px 30px rgba(32,41,48,.3);
    opacity:0; pointer-events:none; transition:opacity .25s, transform .35s var(--spring);
  }
  .toast.show{ opacity:1; transform:translate(-50%,0); }
  /* Pas encore de prénom sur cet appareil : on le choisit dans la bulle, une fois */
  .chat.sans-nom .chat-pour, .chat.sans-nom .chat-form, .chat.sans-nom .chat-dnd{ display:none; }
  .chat.sans-nom .chat-list{ grid-column:1 / -1; grid-row:2 / 4; justify-content:center; align-items:center; gap:14px; padding:20px; }
  .chat-qui-t{ font-size:17px; font-weight:700; text-align:center; }
  .chat-qui-s{ font-size:13.5px; color:var(--muted); text-align:center; max-width:300px; line-height:1.4; }
  .chat-qui{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; width:min(100%, 340px); }
  .chat-qui button{ min-height:96px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; border:0; border-radius:18px;
    background:rgba(255,255,255,.8); box-shadow:inset 0 0 0 1px rgba(74,98,116,.14); font-size:15px; font-weight:600; transition:transform .2s var(--spring); }
  .chat-qui button:hover{ background:#fff; }
  .chat-qui button:active{ transform:scale(.96); }
  .chat-qui .avatar{ width:48px; height:48px; font-size:20px; }
  @media (prefers-reduced-motion:reduce){ .chat-orb{ transition:none; } .chat-panel,.chat-m,.chat-n,.chat-orb.has-new::before,dialog[open]{ animation:none; } }
  /* ---------- La bulle : on se parle en direct, flottante au-dessus de tout ---------- */
  .chat{
    --chat-glass:rgba(255,255,255,.86); --chat-edge:rgba(255,255,255,.85); --vert:#2fcf5f; /* le vert « en ligne » d'Instagram */
    position:fixed; z-index:35; left:0; top:0;   /* will-change seulement pendant qu'on la tire (plus bas) */
    touch-action:none; user-select:none; -webkit-user-select:none;
  }
  .chat-orb{
    position:relative; width:56px; height:56px; border-radius:50%; border:0; padding:0;   /* la même taille que la to do list */
    display:grid; place-items:center;
    /* Pleine, couleur de la maison : on la trouve d'un coup d'œil, sur le planning comme sur le fond */
    background:radial-gradient(120% 120% at 30% 20%, #6ff08f 0%, var(--vert) 55%, #14a83f 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 1px rgba(255,255,255,.12), 0 0 0 1px rgba(32,41,48,.06), 0 8px 22px rgba(20,140,60,.32), 0 2px 6px rgba(32,41,48,.18);
    transition:transform .35s var(--spring), box-shadow .25s; cursor:grab;
  }
  .chat-orb:hover{ transform:scale(1.05); }
  .chat-orb:active{ cursor:grabbing; }
  .chat-orb svg{ width:24px; height:24px; fill:none; stroke:#fff; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
  /* Du neuf : un halo qui respire doucement, sans clignoter */
  .chat-orb.has-new::before{ content:""; position:absolute; inset:-4px; border-radius:50%; border:3px solid rgba(217,48,37,.4); animation:chatHalo 2.4s ease-out infinite; pointer-events:none; }
  /* Le halo grandit et s'efface : transform + opacity seulement, le GPU n'a rien à repeindre (une ombre animée repeignait à chaque image) */
  @keyframes chatHalo{ 0%{ transform:scale(1); opacity:1; } 70%,100%{ transform:scale(1.4); opacity:0; } }
  .chat-orb .chat-n{
    position:absolute; top:-2px; right:-2px; min-width:22px; height:22px; padding:0 6px; border-radius:11px;
    display:grid; place-items:center; background:var(--danger); color:#fff; font-size:12px; font-weight:700;
    box-shadow:0 0 0 2px #fff; animation:chatPop .45s var(--spring);
  }
  /* Qui est en ligne, d'un coup d'œil : leurs initiales sous la bulle, avec la pastille verte */
  .chat-en{ position:absolute; left:50%; top:calc(100% + 6px); transform:translateX(-50%); display:flex; pointer-events:none; }
  .chat-en .avatar{ position:relative; width:24px; height:24px; font-size:12px; margin-left:-6px; color:#fff; background:rgb(var(--a)); box-shadow:0 0 0 2px #fff, 0 2px 6px rgba(32,41,48,.25); }
  .chat-en .avatar:first-child{ margin-left:0; }
  .chat-en .avatar::after, .chat-pour .en-ligne .avatar::after{ content:""; position:absolute; right:-3px; bottom:-3px; width:10px; height:10px; border-radius:50%; background:var(--vert); box-shadow:0 0 0 2px #fff; }
  .chat-panel{
    position:absolute; left:0; top:0; width:min(540px, calc(100vw - 24px)); height:min(540px, calc(100dvh - 24px)); max-width:calc(100vw - 24px); max-height:calc(100dvh - 24px);
    /* Comme WhatsApp : les gens en colonne à gauche, la conversation à droite */
    display:grid; grid-template-columns:minmax(132px, 34%) minmax(0, 1fr); grid-template-rows:auto minmax(0, 1fr) auto; overflow:hidden; border-radius:26px;
    background:var(--chat-glass);
    -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);   /* flou léger : il recalcule tout ce qui bouge dessous (le planning) */
    box-shadow:inset 0 0 0 1px var(--chat-edge), inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 1px rgba(74,98,116,.14), 0 2px 8px rgba(32,41,48,.08), 0 30px 70px rgba(42,58,72,.3);
    transform-origin:var(--ox,0) var(--oy,0); animation:chatOpen .42s var(--spring);
    user-select:text; -webkit-user-select:text;
  }
  .chat.is-min .chat-panel{ display:none; }
  .chat:not(.is-min) .chat-orb{ display:none; }
  @keyframes chatOpen{ from{ opacity:0; transform:scale(.6); } to{ opacity:1; transform:none; } }
  @keyframes chatPop{ from{ transform:scale(.4); } to{ transform:none; } }
  /* Taille au choix : on tire un bord ou un coin du panneau, comme une fenêtre */
  .chat.taille .chat-panel{ user-select:none; -webkit-user-select:none; }
  .chat-head{
    grid-column:1 / -1; display:flex; align-items:center; gap:4px; padding:8px 6px 2px 16px; min-height:52px;
    cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none;
    border-bottom:1px solid rgba(255,255,255,.55);
    background:linear-gradient(to bottom,rgba(255,255,255,.45),rgba(255,255,255,0));
  }
  .chat-head:active{ cursor:grabbing; }
  .chat-grip{ position:absolute; left:50%; top:5px; width:36px; height:4px; margin-left:-18px; border-radius:2px; background:rgba(74,98,116,.22); }
  /* Une seule ligne, et seulement quand elle dit quelque chose : « écrit… », une pause, une reconnexion */
  .chat-etat{ flex:1; min-width:0; font-size:12.5px; font-weight:600; color:var(--duck); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chat-etat.pause{ color:#3d3a8c; }
  .chat-x{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; }
  .chat-x:hover{ background:rgba(74,98,116,.1); }
  .chat-x svg{ width:20px; height:20px; fill:none; stroke:var(--ink); stroke-width:2; stroke-linecap:round; }
  .chat-list{ grid-column:2; grid-row:2; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:14px 12px 6px; display:flex; flex-direction:column; gap:2px; scrollbar-width:thin; }
  .chat-day{ align-self:center; margin:10px 0 6px; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; color:var(--muted); background:rgba(255,255,255,.55); }
  .chat-vide{ margin:auto; max-width:240px; text-align:center; color:var(--muted); font-size:14px; line-height:1.45; }
  .chat-m{ display:flex; align-items:flex-end; gap:8px; max-width:86%; }
  .chat-m.neuf{ animation:chatIn .32s var(--spring); }
  @keyframes chatIn{ from{ opacity:0; transform:translateY(8px) scale(.97); } to{ opacity:1; transform:none; } }
  .chat-m .avatar{ width:28px; height:28px; font-size:12px; background:#fff; visibility:hidden; }
  .chat-m.fin .avatar{ visibility:visible; }
  .chat-m.debut{ margin-top:8px; }
  .chat-b{ min-width:0; padding:8px 12px; border-radius:18px; font-size:15px; line-height:1.38; white-space:pre-line; overflow-wrap:anywhere;
    background:rgba(255,255,255,.86); box-shadow:0 1px 2px rgba(32,41,48,.06); color:var(--ink); }
  .chat-b small{ display:block; margin-bottom:1px; font-size:12px; font-weight:700; color:rgb(var(--a)); }
  .chat-b time{ float:right; margin:6px 0 -4px 10px; font-size:11px; opacity:.55; }
  .chat-m.moi{ align-self:flex-end; flex-direction:row-reverse; }
  .chat-m.moi .avatar{ display:none; }
  .chat-m.moi .chat-b{ background:rgb(var(--a)); color:#fff; box-shadow:0 4px 14px rgba(var(--a),.28); }
  .chat-m.wait .chat-b{ opacity:.6; }
  .chat-m.rate .chat-b{ box-shadow:0 0 0 2px var(--danger); }
  /* Mon message touché : « Supprimer » paraît à côté (un second toucher le retire pour tous) */
  .chat-m.moi:not(.wait):not(.rate) .chat-b{ cursor:pointer; }
  .chat-suppr{ display:none; flex:none; align-self:center; min-height:44px; padding:0 14px; border:0; border-radius:22px; background:#fff; color:var(--danger); font:inherit; font-size:13.5px; font-weight:700; box-shadow:0 1px 3px rgba(32,41,48,.12); cursor:pointer; }
  .chat-m.choix .chat-suppr{ display:inline-flex; align-items:center; }
  .chat-suppr:focus-visible{ outline:3px solid rgba(107,129,145,.45); outline-offset:2px; }
  /* Les conversations : l'équipe, puis une par personne */
  .chat-pour{ grid-column:1; grid-row:2 / 4; min-height:0; display:flex; flex-direction:column; gap:2px; padding:8px 6px; border-right:1px solid rgba(255,255,255,.55); background:rgba(255,255,255,.22); overflow-y:auto; overscroll-behavior:contain; scrollbar-width:none; }
  .chat-pour button{ position:relative; width:100%; min-height:48px; padding:0; border:0; background:none; display:flex; align-items:center; flex-shrink:0; text-align:left; }
  .chat-pour .fil-n{ position:absolute; top:50%; right:8px; margin-top:-9px; min-width:18px; height:18px; padding:0 5px; border-radius:9px; display:grid; place-items:center;
    background:var(--danger); color:#fff; font-size:11px; font-weight:700; box-shadow:0 0 0 2px #fff; }
  .chat-pour button > span:not(.fil-n){ display:flex; align-items:center; gap:8px; width:100%; min-width:0; height:44px; padding:0 30px 0 6px; border-radius:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:13.5px; font-weight:600; color:var(--muted);
    background:rgba(255,255,255,.5); box-shadow:inset 0 0 0 1px rgba(74,98,116,.12); transition:background-color .2s, color .2s, box-shadow .2s; }
  .chat-pour .tous > span:not(.fil-n){ padding-left:11px; }
  .chat-pour .tous svg{ width:18px; height:18px; flex-shrink:0; }
  .chat-pour .nom{ min-width:0; font-style:normal; overflow:hidden; text-overflow:ellipsis; }
  /* En ligne : vert ; sinon neutre */
  .chat-pour .avatar{ width:30px; height:30px; flex-shrink:0; font-size:12px; color:#6b7a86; background:#e9edf0; box-shadow:none; }
  .chat-pour .avatar{ position:relative; }
  .chat-pour .en-ligne .avatar{ color:#fff; background:rgb(var(--a)); }
  .chat-pour .en-ligne > span:not(.fil-n){ color:var(--ink); background:rgba(47,207,95,.16); box-shadow:inset 0 0 0 1.5px var(--vert); }
  .chat-pour button:not(.tous):not(.en-ligne) > span:not(.fil-n){ opacity:.55; }
  .chat-etat.en{ color:#14a83f; }
  .chat-pour button[aria-checked="true"] > span:not(.fil-n){ color:#fff; background:rgb(var(--a)); box-shadow:0 4px 12px rgba(var(--a),.3); }
  .chat-pour button[aria-checked="true"] svg{ stroke:#fff; }
  .chat-pour svg{ width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-form{ grid-column:2; grid-row:3; position:relative; display:flex; align-items:flex-end; gap:8px; padding:6px 8px calc(8px + var(--safe-b)) 12px; }
  /* Note vocale en cours d'enregistrement */
  .chat-rec{ flex:1; min-height:44px; display:flex; align-items:center; gap:10px; padding:0 6px 0 2px; border-radius:22px; background:rgba(255,255,255,.8); box-shadow:inset 0 0 0 1px rgba(217,48,37,.25); font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
  .chat-rec-dot{ width:10px; height:10px; border-radius:50%; background:var(--danger); animation:chatRec 1.1s ease-in-out infinite; }
  @keyframes chatRec{ 50%{ opacity:.25; } }
  .chat-rec-onde{ flex:1; display:flex; align-items:center; justify-content:flex-end; gap:3px; height:28px; overflow:hidden; }
  .chat-rec-onde i{ width:3px; min-height:3px; border-radius:2px; background:var(--danger); opacity:.75; flex-shrink:0; }
  .chat-ic{ width:40px; height:40px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; }
  .chat-ic:hover{ background:rgba(74,98,116,.1); }
  .chat-ic svg{ width:20px; height:20px; fill:none; stroke:var(--ink); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-mic{ background:rgba(255,255,255,.8) !important; box-shadow:inset 0 0 0 1px rgba(74,98,116,.18); }
  .chat-mic svg{ stroke:var(--duck) !important; }
  /* Urgent : le bouton du message, et sa marque dans la bulle */
  .chat-urg{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; color:var(--muted); transition:background-color .2s, color .2s; }
  .chat-urg:hover{ background:rgba(74,98,116,.1); }
  .chat-urg svg{ width:21px; height:21px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-urg[aria-pressed="true"]{ background:var(--danger); color:#fff; box-shadow:0 4px 12px rgba(217,48,37,.3); }
  .chat.urgent .chat-form textarea{ border-color:rgba(217,48,37,.6) !important; box-shadow:0 0 0 3px rgba(217,48,37,.14) !important; }
  .chat-tag{ display:inline-block; margin:0 6px 2px 0; padding:1px 7px; border-radius:999px; background:var(--danger); color:#fff; font-size:11px; font-weight:700; vertical-align:1px; }
  .chat-m.moi .chat-tag{ background:#fff; color:var(--danger); }
  /* Ne pas déranger */
  .chat-dnd{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; }
  .chat-dnd:hover{ background:rgba(74,98,116,.1); }
  .chat-dnd svg{ width:19px; height:19px; fill:none; stroke:var(--ink); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-dnd[aria-pressed="true"]{ background:#3d3a8c; }
  .chat-dnd[aria-pressed="true"] svg{ stroke:#fff; fill:#fff; }
  .chat-menu{ position:absolute; z-index:2; top:58px; right:10px; min-width:230px; padding:6px; border-radius:16px; background:rgba(255,255,255,.96);
    box-shadow:inset 0 0 0 1px rgba(74,98,116,.12), 0 18px 40px rgba(42,58,72,.22); animation:chatPop .25s var(--spring); }
  .chat-menu p{ padding:8px 10px 6px; font-size:12.5px; color:var(--muted); line-height:1.35; }
  .chat-menu button{ display:block; width:100%; min-height:44px; padding:0 12px; border:0; border-radius:10px; background:none; text-align:left; font-size:15px; font-weight:600; }
  .chat-menu button:hover{ background:rgba(74,98,116,.09); }
  .chat-menu button.fin{ color:var(--danger); }
  .chat-pour button.en-pause .avatar{ opacity:.45; }
  .chat-lune{ position:absolute; bottom:2px; left:2px; width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:#3d3a8c; box-shadow:0 0 0 2px #fff; }
  .chat-lune svg{ width:12px; height:12px; fill:#fff; stroke:none; }

  /* Note vocale dans une bulle */
  .chat-voc{ display:flex; align-items:center; gap:10px; min-width:210px; padding:2px 0; }
  .chat-play{ width:40px; height:40px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:rgb(var(--a)); transition:transform .2s var(--spring); }
  .chat-play:active{ transform:scale(.9); }
  .chat-m.moi .chat-play{ background:#fff; }
  .chat-play svg{ width:18px; height:18px; fill:#fff; stroke:none; }
  .chat-m.moi .chat-play svg{ fill:rgb(var(--a)); }
  .chat-onde{ flex:1; display:flex; align-items:center; gap:2px; height:30px; }
  .chat-onde i{ flex:1; max-width:4px; border-radius:2px; background:currentColor; opacity:.28; transition:opacity .15s; }
  .chat-onde i.lu{ opacity:.9; }
  .chat-voc-t{ font-size:12px; font-weight:600; opacity:.7; min-width:30px; text-align:right; }
  .chat-form textarea{
    flex:1; min-height:44px; max-height:132px; padding:11px 14px; border-radius:22px; resize:none;
    border:1px solid rgba(74,98,116,.16); background:rgba(255,255,255,.8); font:inherit; font-size:16px; line-height:1.3; color:var(--ink); outline:none;
    transition:border-color .2s, box-shadow .2s;
  }
  .chat-form textarea:focus{ border-color:var(--duck-focus); box-shadow:0 0 0 3px rgba(74,98,116,.14); }
  .chat-send{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:var(--duck); transition:transform .25s var(--spring), opacity .2s; }
  .chat-send:disabled{ opacity:.35; }
  .chat-send:not(:disabled):active{ transform:scale(.9); }
  .chat-send svg{ width:20px; height:20px; fill:none; stroke:#fff; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; }
  .chat.drag .chat-panel, .chat.drag .chat-orb{ box-shadow:inset 0 0 0 1px var(--chat-edge), 0 34px 80px rgba(42,58,72,.34); }
  .chat.drag .chat-orb{ transform:scale(1.08); }
  .chat.drag{ will-change:transform; }
  @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){ .chat{ --chat-glass:rgba(250,251,252,.96); } }

  /* ---------- Message privé à lire : il s'impose, on ne peut que confirmer ---------- */
  #lire{ width:min(460px, calc(100% - 32px)); margin:auto; border-radius:28px; background:rgba(255,255,255,.82);
    -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px);
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.8), 0 40px 90px rgba(32,41,48,.35); }
  #lire::backdrop{ background:rgba(32,41,48,.5); }   /* voile sans flou : flouter tout l'écran coûte cher */
  .lire{ display:flex; flex-direction:column; align-items:center; gap:14px; padding:28px 24px 22px; text-align:center; }
  .lire > .avatar{ width:72px; height:72px; font-size:30px; background:#fff; box-shadow:inset 0 0 0 1px rgba(var(--a),.3), 0 0 0 6px rgba(var(--a),.12); }
  .lire-de{ font-size:19px; font-weight:700; letter-spacing:-.015em; }
  .lire-sous{ display:inline-flex; align-items:center; gap:5px; margin-top:2px; font-size:13px; font-weight:600; color:rgb(var(--a)); }
  .lire-txt{ align-self:stretch; max-height:40dvh; overflow-y:auto; padding:16px 18px; border-radius:20px; background:#fff; box-shadow:inset 0 0 0 1.5px rgba(var(--a),.35);
    font-size:18px; line-height:1.45; text-align:left; white-space:pre-line; overflow-wrap:anywhere; }
  .lire-txt .chat-voc{ min-width:0; }
  .lire-ok{ align-self:stretch; min-height:52px; font-size:16px; border-radius:16px; background:rgb(var(--a)); color:#fff; border:0; font-weight:700;
    box-shadow:0 8px 22px rgba(var(--a),.32); transition:opacity .2s, transform .2s var(--spring); }
  .lire-ok:disabled{ opacity:.4; box-shadow:none; }
  .lire-ok:not(:disabled):active{ transform:scale(.97); }
  .lire-n{ font-size:12.5px; color:var(--muted); min-height:16px; }
  .chat-b .vu{ font-weight:700; opacity:1; }

  /* ---------- La to do list : un bloc-notes à soi, coché ici, rayé partout ---------- */
  .todo{ position:fixed; z-index:36; left:0; top:0; touch-action:none; user-select:none; -webkit-user-select:none;
    --main:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif; --papier:#fff; --encre:#1d2733; --ligne:rgba(74,98,116,.12); }
  .todo-orb{ position:relative; width:56px; height:56px; border-radius:50%; border:0; padding:0; display:grid; place-items:center; -webkit-touch-callout:none;
    background:#fff; color:#1a73e8;   /* blanc et bleu, comme Google Tasks ou Rappels d'Apple */
    box-shadow:0 0 0 1px rgba(32,41,48,.06), 0 8px 22px rgba(32,41,48,.18), 0 2px 6px rgba(32,41,48,.12);
    transition:transform .35s var(--spring); cursor:grab; }
  .todo-orb:hover{ transform:scale(1.05); }
  .todo-orb:active{ cursor:grabbing; }
  .todo-orb svg{ width:28px; height:28px; fill:none; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
  .todo-orb.has-new::before{ content:""; position:absolute; inset:-4px; border-radius:50%; border:3px solid rgba(217,48,37,.4); animation:chatHalo 2.4s ease-out infinite; pointer-events:none; }
  .todo-n{ position:absolute; top:-3px; right:-3px; min-width:22px; height:22px; padding:0 6px; border-radius:11px; display:grid; place-items:center;
    background:var(--danger); color:#fff; font-size:12px; font-weight:700; box-shadow:0 0 0 2px #fff; animation:chatPop .45s var(--spring); }
  .todo-panel{ position:absolute; left:0; top:0; width:min(340px, calc(100vw - 24px)); height:min(480px, calc(100dvh - 24px));
    display:flex; flex-direction:column; overflow:hidden; border-radius:22px; background:var(--papier);
    box-shadow:0 0 0 1px rgba(74,98,116,.14), 0 2px 8px rgba(32,41,48,.08), 0 30px 70px rgba(42,58,72,.28);
    transform-origin:var(--ox,0) var(--oy,0); animation:chatOpen .42s var(--spring); user-select:text; -webkit-user-select:text; }
  .todo.is-min .todo-panel{ display:none; }
  .todo:not(.is-min) .todo-orb{ display:none; }
  .todo.drag .todo-panel, .todo.drag .todo-orb{ box-shadow:0 0 0 1px rgba(74,98,116,.14), 0 34px 80px rgba(42,58,72,.34); }
  .todo.drag{ will-change:transform; }
  .todo-head{ position:relative; display:flex; align-items:center; gap:8px; min-height:58px; padding:8px 6px 0 18px; cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
  .todo-head:active{ cursor:grabbing; }
  .todo-t{ font-family:var(--main); font-size:22px; font-weight:700; letter-spacing:-.01em; line-height:1; color:var(--encre); }
  .todo-c{ flex:1; min-width:0; padding-top:6px; font-size:12.5px; font-weight:600; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .todo-add{ display:flex; align-items:center; margin:0 8px 0 52px; border-bottom:1px solid var(--ligne); transition:border-color .2s; }
  .todo-add:focus-within{ border-bottom-color:var(--duck); }
  .todo-add input{ flex:1; min-width:0; height:48px; border:0; background:none; outline:none; font-family:var(--main); font-size:16px; color:var(--encre); }
  .todo-add input::placeholder{ color:rgba(35,50,74,.38); }
  .todo-plus{ width:44px; height:44px; flex-shrink:0; border:0; border-radius:50%; background:none; display:grid; place-items:center; }
  .todo-plus:hover{ background:rgba(74,98,116,.1); }
  .todo-plus svg{ width:20px; height:20px; fill:none; stroke:var(--encre); stroke-width:2.2; stroke-linecap:round; }
  .todo-list{ flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; list-style:none; padding:4px 0 10px; scrollbar-width:thin; }
  .todo-i{ display:flex; align-items:flex-start; min-height:50px; padding-right:4px; border-bottom:1px solid var(--ligne); }
  .todo-cc{ width:44px; height:48px; flex-shrink:0; border:0; background:none; display:grid; place-items:center; }
  .todo-cc:disabled{ cursor:default; }
  .todo-cc svg{ width:22px; height:22px; fill:none; stroke:var(--encre); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .todo-cc circle{ opacity:.55; }
  .todo-i.fait .todo-cc circle{ opacity:1; stroke:#1a73e8; fill:#1a73e8; }
  .todo-cc .v{ stroke:#fff; stroke-width:2.4; stroke-dasharray:16; stroke-dashoffset:16; }
  .todo-i.fait .todo-cc .v{ stroke-dashoffset:0; }
  .todo-i.raye .todo-cc .v{ animation:coche .3s ease-out; }
  @keyframes coche{ from{ stroke-dashoffset:16; } }
  .todo-corps{ flex:1; min-width:0; padding:13px 6px 12px 4px; display:flex; flex-direction:column; align-items:flex-start; gap:3px; }
  .todo-tx{ font-family:var(--main); font-size:16px; font-weight:500; line-height:1.35; color:var(--encre); overflow-wrap:anywhere; transition:color .3s; }
  /* Le trait qui raye, ligne par ligne */
  .todo-tx > span{ background:linear-gradient(currentColor, currentColor) no-repeat 0 55% / 0 1.5px; -webkit-box-decoration-break:clone; box-decoration-break:clone; }
  .todo-i.fait .todo-tx{ color:rgba(35,50,74,.5); }
  .todo-i.fait .todo-tx > span{ background-size:100% 1.5px; }
  .todo-i.raye .todo-tx > span{ animation:raye .45s ease-out; }
  @keyframes raye{ from{ background-size:0 1.5px; } }
  .todo-ic{ width:40px; height:48px; flex-shrink:0; border:0; border-radius:12px; background:none; display:grid; place-items:center; color:var(--muted); }
  .todo-ic:hover{ background:rgba(74,98,116,.09); color:var(--ink); }
  .todo-ic svg{ width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; }
  /* LA RÉPONSE EN UN CLIC : des boutons tous pareils (même hauteur ; deux côte à côte, de même
     largeur), et « fait » dans la même case, en vert. Jamais un mot coupé ni qui déborde : un
     bouton seul prend la ligne, deux qui ne tiennent pas côte à côte passent l'un sous l'autre. */
  .todo-quand{ font-size:12.5px; line-height:1.3; color:var(--muted); }
  .todo-acts{ display:flex; flex-wrap:wrap; gap:6px; width:100%; margin-top:6px; }
  .todo-act{ flex:1 1 0; height:44px; padding:0 12px; border:1px solid var(--ligne); border-radius:12px; background:#fff; color:var(--encre);
    font-family:var(--main); font-size:14px; font-weight:700; line-height:1; white-space:nowrap; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:6px; transition:transform .15s, opacity .2s; }
  .todo-act:active{ transform:scale(.97); }
  .todo-act:disabled{ opacity:.5; cursor:default; }
  .todo-act:focus-visible{ outline:3px solid rgba(74,98,116,.4); outline-offset:2px; }
  .todo-act.go{ background:var(--duck); border-color:var(--duck); color:#fff; }
  .todo-act.oui, .todo-act.ok{ background:#1e8e3e; border-color:#1e8e3e; color:#fff; }
  .todo-act.ok{ cursor:default; opacity:.85; }
  .todo-act svg{ width:16px; height:16px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; }
  @media (hover:hover){ .todo-act:not(.ok):not(:disabled):hover{ filter:brightness(.95); } }
  .todo-vide{ padding:26px 20px 0 56px; font-size:15px; color:var(--muted); }
  .todo-vider{ flex-shrink:0; min-height:44px; border:0; border-top:1px solid var(--ligne); background:none; font-size:13.5px; font-weight:600; color:var(--muted); }
  .todo-vider:hover{ color:var(--danger); }
  /* ---------- Clic droit : cacher / afficher la to do list ou la messagerie ---------- */
  .ctx{ position:fixed; z-index:60; left:0; top:0; min-width:236px; padding:6px; border-radius:14px; background:rgba(255,255,255,.98);
    box-shadow:inset 0 0 0 1px rgba(74,98,116,.14), 0 18px 40px rgba(42,58,72,.24); animation:chatPop .2s var(--spring); }
  .ctx button{ display:flex; align-items:center; gap:10px; width:100%; min-height:44px; padding:0 12px; border:0; border-radius:10px; background:none; text-align:left; font-size:15px; font-weight:600; }
  .ctx button:hover, .ctx button:focus-visible{ background:rgba(74,98,116,.1); outline:none; }
  .ctx svg{ width:18px; height:18px; flex-shrink:0; fill:none; stroke:var(--muted); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  /* Tout est caché : un petit point en bas à droite pour tout remettre */
  .rappel{ position:fixed; right:calc(2px + env(safe-area-inset-right,0px)); bottom:calc(2px + var(--safe-b)); width:44px; height:44px; border:0; background:none; display:grid; place-items:center; }
  .rappel i{ width:12px; height:12px; border-radius:50%; background:rgba(74,98,116,.38); box-shadow:0 0 0 2px rgba(255,255,255,.85); transition:transform .2s, background-color .2s; }
  .rappel:hover i, .rappel:focus-visible i{ transform:scale(1.4); background:var(--duck); }
  .rappel.neuf i{ background:var(--danger); }
  @media (prefers-reduced-motion:reduce){ .todo-orb{ transition:none; } .todo-panel, .todo-orb.has-new::before, .todo-i.raye .todo-tx > span, .todo-i.raye .todo-cc .v, .ctx{ animation:none; } }
</style>
<div class="chat is-min" id="chat" hidden>
  <button type="button" class="chat-orb" id="chat-orb" aria-label="Ouvrir la discussion de l'équipe">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>
    <span class="chat-n" id="chat-n" hidden></span>
    <span class="chat-lune" id="chat-lune" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></span>
  </button>
  <section class="chat-panel" id="chat-panel" aria-label="Discussion de l'équipe">
    <header class="chat-head" id="chat-head">
      <span class="chat-grip" aria-hidden="true"></span>
      <small class="chat-etat" id="chat-etat" aria-live="polite"></small>
      <button type="button" class="chat-dnd" id="chat-dnd" aria-pressed="false" aria-haspopup="true" aria-label="Ne pas déranger" title="Ne pas déranger">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
      </button>
      <button type="button" class="chat-x" id="chat-x" aria-label="Réduire la discussion" title="Réduire (Échap)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
      </button>
    </header>
    <div class="chat-menu" id="chat-menu" role="menu" hidden></div>
    <nav class="chat-pour" id="chat-pour" role="tablist" aria-label="Conversations"></nav>
    <div class="chat-list" id="chat-list" role="log" aria-live="polite"></div>
    <form class="chat-form" id="chat-form" autocomplete="off">
      <div class="chat-rec" id="chat-rec" hidden>
        <button type="button" class="chat-ic" id="chat-rec-x" aria-label="Annuler la note vocale" title="Annuler">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>
        </button>
        <span class="chat-rec-dot" aria-hidden="true"></span><span id="chat-rec-t">0:00</span>
        <span class="chat-rec-onde" id="chat-rec-onde" aria-hidden="true"></span>
      </div>
      <button type="button" class="chat-urg" id="chat-urg" aria-pressed="false" hidden title="Urgent : il devra confirmer « J'ai lu » avant de continuer" aria-label="Marquer urgent">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6c0 5-2 6.5-2 6.5h16S18 14 18 9a6 6 0 0 0-6-6z"/><path d="M10.3 19.5a2 2 0 0 0 3.4 0"/><path d="M12 7.5v3.5"/><path d="M12 13.4v.1"/></svg>
      </button>
      <textarea id="chat-txt" rows="1" maxlength="1000" placeholder="Écrire à l'équipe…" enterkeyhint="send" aria-label="Message"></textarea>
      <button type="button" class="chat-send chat-mic" id="chat-mic" aria-label="Enregistrer une note vocale" title="Note vocale">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>
      </button>
      <button type="submit" class="chat-send" id="chat-send" aria-label="Envoyer" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
      </button>
    </form>
  </section>
</div>
<div class="todo is-min" id="todo" hidden>
  <button type="button" class="todo-orb" id="todo-orb" aria-label="Ouvrir ma to do list">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16 9.7"/></svg>
    <span class="todo-n" id="todo-n" hidden></span>
  </button>
  <section class="todo-panel" id="todo-panel" aria-label="Ma to do list">
    <header class="todo-head" id="todo-head">
      <span class="chat-grip" aria-hidden="true"></span>
      <h2 class="todo-t">À faire</h2>
      <small class="todo-c" id="todo-c" aria-live="polite"></small>
      <button type="button" class="chat-x" id="todo-x" aria-label="Réduire la to do list" title="Réduire (Échap)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
      </button>
    </header>
    <form class="todo-add" id="todo-add" autocomplete="off">
      <input id="todo-txt" type="text" maxlength="300" placeholder="Ajouter une tâche…" enterkeyhint="done" aria-label="Nouvelle tâche">
      <button type="submit" class="todo-plus" aria-label="Ajouter la tâche"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
    </form>
    <ul class="todo-list" id="todo-list" aria-label="Tâches"></ul>
    <button type="button" class="todo-vider" id="todo-vider" hidden></button>
  </section>
</div>
<div class="ctx" id="ctx" role="menu" hidden></div>
<button type="button" class="rappel" id="rappel" hidden aria-label="Afficher la to do list ou la messagerie" title="To do list et messagerie cachées ici : toucher pour les remettre"><i></i></button>
<dialog id="lire" aria-labelledby="lire-de" aria-describedby="lire-txt">
  <div class="lire">
    <span class="avatar" id="lire-av" aria-hidden="true"></span>
    <div><div class="lire-de" id="lire-de"></div><div class="lire-sous"><span id="lire-quand"></span></div></div>
    <div class="lire-txt" id="lire-txt"></div>
    <button type="button" class="lire-ok" id="lire-ok">J'ai lu</button>
    <div class="lire-n" id="lire-n"></div>
  </div>
</dialog>

<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  const $ = s => root.querySelector(s);
  const el = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const SVG = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const avatar = (p, cls) => { const a = el('span', 'avatar' + (cls ? ' ' + cls : '')); a.style.setProperty('--a', p.tint); a.textContent = p.name.charAt(0); a.setAttribute('aria-hidden', 'true'); return a; };
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  // Ce qu'on tape dans la bulle reste dans la bulle : les raccourcis de l'appli ne le voient pas.
  for (const t of ['keydown', 'keyup', 'keypress', 'paste', 'copy', 'cut']) root.addEventListener(t, e => e.stopPropagation());

  let toastTimer;
  // Le toast commun (messages.js) quand l'appli le charge ; sinon celui de la bulle, au même dessin.
  function toast(msg){
    if (window.oldaMessages) return window.oldaMessages.toast(msg, { ms: 3500 });
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }
  // Le son ne part qu'après un premier geste sur la page (règle des navigateurs).
  let audio = null;
  const debloquer = () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state !== 'running') audio.resume(); } catch (_) {} };
  addEventListener('pointerdown', debloquer, { passive: true, capture: true });
  addEventListener('keydown', debloquer, { capture: true });
  function sonner(){
    if (!audio || audio.state !== 'running') return;
    const t0 = audio.currentTime + .02;
    [[880, 0], [659, .22], [880, .7], [659, .92]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + d); g.gain.linearRampToValueAtTime(.32, t0 + d + .02); g.gain.exponentialRampToValueAtTime(.001, t0 + d + .6);
      o.connect(g).connect(audio.destination); o.start(t0 + d); o.stop(t0 + d + .65);
    });
  }

  // ---------- La bulle : l'équipe se parle en direct (BAT Studio, /api/chat) ----------
  // Une seule conversation pour tous. En ligne, BAT Studio pousse chaque message par WebSocket
  // (et dit qui est là, qui écrit) ; si le WebSocket ne passe pas (BAT Studio local), on relève.
  // La bulle se déplace d'un doigt (par son en-tête, ou la pastille réduite) et garde sa place sur l'appareil.
  const LS_CHAT = 'olda_chat', LS_CHAT_POS = 'olda_chat_pos', LS_CHAT_VU = 'olda_chat_vu';
  const chat = $('#chat'), chatOrb = $('#chat-orb'), chatPanel = $('#chat-panel'), chatList = $('#chat-list');
  const chatTxt = $('#chat-txt'), chatSend = $('#chat-send'), chatEtat = $('#chat-etat');
  const ORB = 56, MARGE = 12, AIMANT = 40;   // à moins de 40 px d'un bord, elle s'y colle
  let msgs = [], chatWs = null, chatEssais = 0, chatSonde = null, chatRetry = null, chatMode = 'ws';
  let presents = [], tapeurs = new Map(), derniereTape = 0, chatAffiches = new Set(), chatChoix = null;
  let pauses = {}, chatUrgent = false;   // qui est en « Ne pas déranger » (jusqu'à quand) ; le prochain message est-il urgent ?
  const enPause = id => !!id && Date.parse(pauses[id]) > Date.now();
  // Le dernier message vu, conversation par conversation ({ tous: id, julien: id, … }).
  let chatVu = (() => { const v = store.get(LS_CHAT_VU); return v && typeof v === 'object' ? v : {}; })();
  let chatPour = 'tous';   // à qui part le prochain message : l'équipe, ou une seule personne
  // Le cache est rangé au nom de la personne au poste : un message privé ne s'affiche jamais chez un autre prénom.
  { const c = store.get(LS_CHAT); if (c && c.qui === me()?.id && Array.isArray(c.msgs)) msgs = c.msgs; }

  // --- Place à l'écran : une position (coin haut-gauche), bornée à la fenêtre ---
  const chatPos = Object.assign({ x: null, y: null, ouvert: DASHBOARD }, store.get(LS_CHAT_POS) || {});
  const taille = () => chatPos.ouvert ? { w: chatPanel.offsetWidth || 372, h: chatPanel.offsetHeight || 520 } : { w: ORB, h: ORB };
  function borner(){
    const { w, h } = taille(), vw = innerWidth, vh = innerHeight;
    if (chatPos.x == null) { if (vw < 200 || vh < 200) return; chatPos.x = vw - w - 24; chatPos.y = vh - h - 92; }   // fenêtre pas encore dimensionnée : on attend le resize
    chatPos.x = Math.min(Math.max(MARGE, chatPos.x), Math.max(MARGE, vw - w - MARGE));
    chatPos.y = Math.min(Math.max(MARGE, chatPos.y), Math.max(MARGE, vh - h - MARGE));
  }
  function placer(){ borner(); chat.style.transform = `translate3d(${Math.round(chatPos.x)}px,${Math.round(chatPos.y)}px,0)`; }
  const garderPos = () => store.set(LS_CHAT_POS, chatPos);
  // Ouvrir / réduire : le panneau pousse vers le milieu de l'écran depuis la pastille, et inversement.
  function basculer(ouvrir){
    if (ouvrir === chatPos.ouvert) return;
    const vw = innerWidth, vh = innerHeight;
    if (ouvrir) {
      const droite = chatPos.x + ORB / 2 > vw / 2, bas = chatPos.y + ORB / 2 > vh / 2;
      chatPos.ouvert = true; chat.classList.remove('is-min');
      const { w, h } = taille();
      chatPanel.style.setProperty('--ox', droite ? '100%' : '0'); chatPanel.style.setProperty('--oy', bas ? '100%' : '0');
      chatPos.x = droite ? chatPos.x + ORB - w : chatPos.x; chatPos.y = bas ? chatPos.y + ORB - h : chatPos.y;
      placer(); lireTout();
      if (matchMedia('(hover:hover)').matches) chatTxt.focus({ preventScroll: true });
      chatList.scrollTop = chatList.scrollHeight;
    } else {
      const { w, h } = taille();
      const droite = chatPos.x + w / 2 > vw / 2, bas = chatPos.y + h / 2 > vh / 2;
      chatPos.ouvert = false; chat.classList.add('is-min');
      chatPos.x = droite ? chatPos.x + w - ORB : chatPos.x; chatPos.y = bas ? chatPos.y + h - ORB : chatPos.y;
      placer();
    }
    garderPos();
  }

  // --- Glisser : au-delà de 5 px c'est un déplacement, sinon un simple toucher ---
  let glisse = null, vientDeGlisser = false;
  function prise(e){
    const bt = e.target.closest('button');
    if (e.button > 0 || (bt && bt !== e.currentTarget)) return;   // un bouton intérieur se touche ; la bulle elle-même se saisit tout de suite
    glisse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: chatPos.x, py: chatPos.y, bouge: false, cible: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function deplacer(e){
    if (!glisse || e.pointerId !== glisse.id) return;
    const dx = e.clientX - glisse.x0, dy = e.clientY - glisse.y0;
    if (!glisse.bouge && Math.hypot(dx, dy) < 2) return;
    if (!glisse.bouge) { glisse.bouge = true; chat.classList.add('drag'); chat.style.transition = 'none'; }
    chatPos.x = glisse.px + dx; chatPos.y = glisse.py + dy;
    placer();
  }
  function lacher(e){
    if (!glisse || e.pointerId !== glisse.id) return;
    const bouge = glisse.bouge; glisse = null; chat.classList.remove('drag');
    if (!bouge) return;
    vientDeGlisser = true; setTimeout(() => { vientDeGlisser = false; }, 0);
    // Elle reste où on la lâche ; tout près d'un bord, un aimant la colle contre lui.
    borner();
    const { w, h } = taille(), dX = innerWidth - w - MARGE, dY = innerHeight - h - MARGE;
    const colle = v => v - MARGE < AIMANT ? MARGE : null;
    const x = colle(chatPos.x) ?? (dX - chatPos.x < AIMANT ? dX : chatPos.x);
    const y = colle(chatPos.y) ?? (dY - chatPos.y < AIMANT ? dY : chatPos.y);
    chat.style.transition = (x !== chatPos.x || y !== chatPos.y) && !reduced.matches ? 'transform .45s cubic-bezier(.34,1.4,.64,1)' : '';
    chatPos.x = x; chatPos.y = y;
    placer(); garderPos();
  }
  for (const poignee of [chatOrb, $('#chat-head')]) {
    poignee.addEventListener('pointerdown', prise);
    poignee.addEventListener('pointermove', deplacer);
    poignee.addEventListener('pointerup', lacher);
    poignee.addEventListener('pointercancel', lacher);
  }
  chat.addEventListener('transitionend', () => { chat.style.transition = ''; });
  chatOrb.onclick = () => { if (!vientDeGlisser && !appuiLongPris()) basculer(true); };
  $('#chat-x').onclick = () => basculer(false);
  chatPanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); basculer(false); chatOrb.focus(); } });
  addEventListener('resize', () => { if (!chat.hidden) { appliquerTaille(); placer(); } if (!todo.hidden) placerT(); });

  // --- Taille : on tire un bord ou un coin du panneau ouvert ; elle est gardée sur l'appareil ---
  const BORD = 8, COIN = 20, MIN_W = 380, MIN_H = 360;
  function appliquerTaille(){
    if (!chatPos.w) return;
    chatPanel.style.width = Math.max(MIN_W, Math.min(chatPos.w, innerWidth - 2 * MARGE)) + 'px';
    chatPanel.style.height = Math.max(MIN_H, Math.min(chatPos.h, innerHeight - 2 * MARGE)) + 'px';
  }
  // Quel bord est sous le doigt : 'n', 'se', 'w'… ou '' au milieu.
  function zoneBord(e){
    const r = chatPanel.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    // Les coins sont arrondis : on les attrape un peu plus loin du bord.
    const coin = (x < COIN || x > r.width - COIN) && (y < COIN || y > r.height - COIN), b = coin ? COIN : BORD;
    return (y < b ? 'n' : y > r.height - b ? 's' : '') + (x < b ? 'w' : x > r.width - b ? 'e' : '');
  }
  const CURSEUR = { n: 'ns', s: 'ns', e: 'ew', w: 'ew', ne: 'nesw', sw: 'nesw', nw: 'nwse', se: 'nwse' };
  let tire = null;
  chatPanel.addEventListener('pointermove', e => {
    if (tire) {
      const dx = e.clientX - tire.x0, dy = e.clientY - tire.y0, z = tire.zone;
      let { x, y, w, h } = tire;
      const maxW = innerWidth - 2 * MARGE, maxH = innerHeight - 2 * MARGE;
      if (z.includes('e')) w = Math.min(Math.max(MIN_W, w + dx), innerWidth - MARGE - x);
      if (z.includes('s')) h = Math.min(Math.max(MIN_H, h + dy), innerHeight - MARGE - y);
      if (z.includes('w')) { const nw = Math.min(Math.max(MIN_W, w - dx), x + w - MARGE, maxW); x += w - nw; w = nw; }
      if (z.includes('n')) { const nh = Math.min(Math.max(MIN_H, h - dy), y + h - MARGE, maxH); y += h - nh; h = nh; }
      chatPos.w = w; chatPos.h = h; chatPos.x = x; chatPos.y = y;
      appliquerTaille(); placer();
      return;
    }
    if (e.pointerType === 'mouse') { const z = zoneBord(e); chatPanel.style.cursor = z ? CURSEUR[z] + '-resize' : ''; }
  });
  chatPanel.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const zone = zoneBord(e); if (!zone) return;
    e.preventDefault(); e.stopPropagation();
    tire = { zone, x0: e.clientX, y0: e.clientY, x: chatPos.x, y: chatPos.y, w: chatPanel.offsetWidth, h: chatPanel.offsetHeight };
    chatPanel.setPointerCapture(e.pointerId); chat.classList.add('taille'); chat.style.transition = 'none';
  }, true);
  const lacherTaille = () => { if (!tire) return; tire = null; chat.classList.remove('taille'); chat.style.transition = ''; garderPos(); };
  chatPanel.addEventListener('pointerup', lacherTaille);
  chatPanel.addEventListener('pointercancel', lacherTaille);
  appliquerTaille();

  // --- Affichage ---
  const heure = iso => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = iso => {
    const d = new Date(iso), a = new Date(); a.setHours(0, 0, 0, 0);
    const j = Math.round((a - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
    return j === 0 ? 'Aujourd’hui' : j === 1 ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const profilDe = id => PROFILES.find(x => x.id === id);
  // Comme WhatsApp : la conversation d'équipe, puis une conversation par personne.
  // Un message appartient au fil « tous », ou au fil de l'autre personne (qu'il vienne d'elle ou de moi).
  const filDe = m => { const p = me(); return !m.pour || m.pour === 'tous' ? 'tous' : m.de === p?.id ? m.pour : m.de; };
  function renderChat(){
    const p = me(); if (!p) return;
    const enBas = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 80;
    const out = []; let jourAvant = '';
    const liste = msgs.filter(m => filDe(m) === chatPour);
    liste.forEach((m, i, msgs) => {
      const j = jour(m.at);
      if (j !== jourAvant) { const d = el('div', 'chat-day'); d.textContent = j; out.push(d); jourAvant = j; }
      const av = msgs[i - 1], ap = msgs[i + 1], proche = (a, b) => a && b && a.de === b.de && Math.abs(Date.parse(b.at) - Date.parse(a.at)) < 5 * 60000 && jour(a.at) === jour(b.at);
      const de = profilDe(m.de), moi = m.de === p.id;
      const row = el('div', 'chat-m' + (moi ? ' moi' : '') + (proche(av, m) ? '' : ' debut') + (proche(m, ap) ? '' : ' fin') + (m.wait ? ' wait' : '') + (m.rate ? ' rate' : '') + (chatAffiches.has(m.id) ? '' : ' neuf'));
      row.style.setProperty('--a', de ? de.tint : '91,107,120');
      const prive = m.pour && m.pour !== 'tous';
      const b = el('div', 'chat-b');
      // Le prénom au-dessus des bulles, seulement dans la conversation d'équipe.
      if (!moi && !prive && !proche(av, m)) { const n = el('small'); n.textContent = de ? de.name : '?'; b.append(n); }
      const t = el('time'); t.dateTime = m.at; t.textContent = m.rate ? 'Non envoyé · toucher pour réessayer' : heure(m.at);
      // Mon message privé : l'autre l'a-t-il lu ?
      if (moi && prive && !m.wait && !m.rate) { const v = el('span', m.lu ? 'vu' : ''); v.textContent = m.lu ? ` · ✓✓ Lu ${heure(m.lu)}` : ' · ✓ Pas encore lu'; t.append(v); }
      if (m.urgent) { const u = el('span', 'chat-tag'); u.textContent = 'Urgent'; b.append(u); }
      if (m.vocal) b.append(lecteurVocal(m), t);
      else b.append(document.createTextNode(m.texte), t);
      if (moi && !m.wait && !m.rate) {
        if (m.id === chatChoix) row.classList.add('choix');
        b.onclick = e => { if (e.target.closest('button,audio,input')) return; chatChoix = chatChoix === m.id ? null : m.id; renderChat(); };
        const x = el('button', 'chat-suppr'); x.type = 'button'; x.textContent = 'Supprimer';
        x.setAttribute('aria-label', 'Supprimer ce message pour tout le monde');
        x.onclick = () => supprimerMsg(m);
        row.append(x);
      }
      if (m.rate) {
        row.style.cursor = 'pointer';
        row.onclick = () => { msgs = msgs.filter(x => x !== m); m.vocal ? envoyerVocal(m._blob, m.vocal.duree, m.pour, !!m.urgent) : envoyer(m.texte, m.pour, !!m.urgent); };
      }
      row.prepend(de ? avatar(de) : el('span', 'avatar'), b);
      out.push(row);
    });
    if (!liste.length) {
      const v = el('p', 'chat-vide'), dest = profilDe(chatPour);
      v.textContent = dest ? `Aucun message avec ${dest.name} pour l’instant.` : 'Aucun message pour l’instant.';
      out.push(v);
    }
    const filAvant = chatList.dataset.fil;
    chatList.replaceChildren(...out);
    chatList.dataset.fil = chatPour;
    chatAffiches = new Set(msgs.map(m => m.id));
    if (enBas || filAvant !== chatPour || liste.at(-1)?.de === p.id) chatList.scrollTop = chatList.scrollHeight;
    majEtat(); majNonLus();
  }
  function majEtat(){
    const p = me(); if (!p) return;
    const autres = PROFILES.filter(x => x.id !== p.id);
    // « écrit… » : dans l'équipe, ceux qui écrivent à l'équipe ; en privé, seulement l'autre, s'il m'écrit.
    const dest = profilDe(chatPour);
    const ecrit = [...tapeurs.entries()].filter(([id, t]) => id !== p.id && (dest ? id === dest.id && t.prive : !t.prive)).map(([id]) => profilDe(id)?.name).filter(Boolean);
    chatEtat.classList.toggle('tape', !!ecrit.length);
    const la = autres.filter(x => presents.includes(x.id)).map(x => x.name);
    chatOrb.classList.toggle('is-live', la.length > 0);
    let en = chatOrb.querySelector('.chat-en');
    if (!la.length) en?.remove();
    else { en = en || chatOrb.appendChild(el('span', 'chat-en')); en.replaceChildren(...autres.filter(x => presents.includes(x.id)).map(x => avatar(x))); }
    chatEtat.classList.remove('en');
    if (ecrit.length) { chatEtat.textContent = `${ecrit.join(' et ')} ${ecrit.length > 1 ? 'écrivent' : 'écrit'}…`; return; }
    chatEtat.classList.toggle('pause', enPause(p.id) || (!!dest && enPause(dest.id)));
    if (enPause(p.id)) { chatEtat.textContent = `Ne pas déranger · jusqu’à ${heure(pauses[p.id])}`; return; }
    if (dest && enPause(dest.id)) { chatEtat.textContent = `En pause jusqu’à ${heure(pauses[dest.id])}`; return; }
    chatEtat.classList.toggle('en', chatMode !== 'coupe' && la.length > 0);
    chatEtat.textContent = chatMode === 'coupe' ? 'Reconnexion…' : la.length ? `● En ligne : ${la.join(', ')}` : '';
  }
  // Non lus d'une conversation : les messages des autres après le dernier vu de ce fil.
  function nonLus(fil){
    const p = me(), l = msgs.filter(m => filDe(m) === fil && !m.wait);
    const i = l.findIndex(m => m.id === chatVu[fil]);
    return l.slice(i + 1).filter(m => m.de !== p.id).length;
  }
  function majNonLus(){
    const p = me(); if (!p) return;
    const n = ['tous', ...PROFILES.filter(x => x.id !== p.id).map(x => x.id)].reduce((t, f) => t + nonLus(f), 0);
    renderPour();
    const c = $('#chat-n'); c.hidden = !n || chatPos.ouvert; c.textContent = n > 9 ? '9+' : String(n);
    chatOrb.classList.toggle('has-new', !!n);
    chatOrb.setAttribute('aria-label', n ? `Discussion de l'équipe : ${n} message${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}` : 'Ouvrir la discussion de l’équipe');
  }
  function lireTout(){
    const dernier = msgs.filter(m => !m.wait && filDe(m) === chatPour).at(-1);
    if (dernier && chatPos.ouvert && !document.hidden) {
      chatVu[chatPour] = dernier.id; store.set(LS_CHAT_VU, chatVu);
      // Un message privé discret est « Lu » dès que sa conversation est sous mes yeux (l'urgent, lui, se confirme).
      const p = me();
      msgs.filter(m => filDe(m) === chatPour && m.pour === p?.id && m.lu === null && !m.urgent && !m.wait).forEach(confirmerLu);
    }
    majNonLus();
  }
  function confirmerLu(m){
    const p = me(); if (!p) return;
    m.lu = new Date().toISOString();   // aussitôt chez moi ; le serveur confirme et prévient l'auteur
    garderChat();
    if (chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'lu', id: m.id }));
    else fetch(`${BAT}/api/chat/lu/${encodeURIComponent(m.id)}?qui=${encodeURIComponent(p.id)}`, { method: 'POST' }).catch(() => {});
  }
  // Retirer mon message : aussitôt chez moi, le serveur le retire chez les autres.
  function supprimerMsg(m){
    const p = me(); if (!p || m.de !== p.id) return;
    chatChoix = null; msgs = msgs.filter(x => x !== m); garderChat(); renderChat();
    if (chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'suppr', id: m.id }));
    else fetch(`${BAT}/api/chat/suppr/${encodeURIComponent(m.id)}?qui=${encodeURIComponent(p.id)}`, { method: 'POST' }).catch(() => {});
  }
  const garderChat = () => store.set(LS_CHAT, { qui: me()?.id, msgs: msgs.filter(m => !m.wait && !m.rate).slice(-200) });
  // Un « toc » discret, différent du ding-dong des notifications.
  function toc(){
    if (!audio || audio.state !== 'running') return;
    const t0 = audio.currentTime + .01, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(740, t0); o.frequency.exponentialRampToValueAtTime(1110, t0 + .09);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.14, t0 + .015); g.gain.exponentialRampToValueAtTime(.001, t0 + .28);
    o.connect(g).connect(audio.destination); o.start(t0); o.stop(t0 + .3);
  }

  // --- Recevoir ---
  function recevoir(m){
    const p = me();
    const k = m.cle ? msgs.findIndex(x => x.wait && x.cle === m.cle) : -1;
    if (k >= 0) { msgs[k] = m; chatAffiches.add(m.id); }
    else if (!msgs.some(x => x.id === m.id)) {
      msgs.push(m);
      if (p && m.de !== p.id) { clearTimeout(tapeurs.get(m.de)?.t); tapeurs.delete(m.de); if ((!chatPos.ouvert || document.hidden || filDe(m) !== chatPour) && !enPause(p.id) && !m.urgent) toc(); }
    }
    msgs = msgs.slice(-200); garderChat(); renderChat(); lireTout(); aLire();
  }
  function fusionner(liste){
    const enAttente = msgs.filter(m => m.wait || m.rate);
    msgs = [...liste, ...enAttente.filter(m => !liste.some(x => x.cle && x.cle === m.cle))];
    garderChat(); renderChat(); lireTout(); aLire();
  }
  function connecter(){
    const p = me(); if (!p) return;
    clearTimeout(chatRetry); clearInterval(chatSonde); chatSonde = null;
    if (chatWs) { chatWs.onclose = null; chatWs.close(); chatWs = null; }
    let ws;
    try { ws = new WebSocket(BAT.replace(/^http/, 'ws') + '/api/chat/ws?qui=' + encodeURIComponent(p.id)); } catch (_) { return sonder(); }
    chatWs = ws; let ouvert = false;
    ws.onopen = () => { ouvert = true; chatEssais = 0; chatMode = 'ws'; majEtat(); };
    ws.onmessage = ev => {
      let e; try { e = JSON.parse(ev.data); } catch (_) { return; }
      if (e.type === 'tout') { presents = e.presents || []; pauses = e.pauses || {}; fusionner(e.messages || []); }
      else if (e.type === 'pauses') { pauses = e.pauses || {}; majPause(); }
      else if (e.type === 'msg') recevoir(e.msg);
      else if (e.type === 'presents') { presents = e.presents || []; majEtat(); renderPour(); }
      else if (e.type === 'tape') { clearTimeout(tapeurs.get(e.de)?.t); tapeurs.set(e.de, { prive: !!e.prive, t: setTimeout(() => { tapeurs.delete(e.de); majEtat(); }, 4000) }); majEtat(); }
      else if (e.type === 'suppr') { const n = msgs.length; msgs = msgs.filter(x => x.id !== e.id); if (msgs.length !== n) { garderChat(); renderChat(); majNonLus(); } }
      else if (e.type === 'lu') { const m = msgs.find(x => x.id === e.id); if (m) { m.lu = e.lu; garderChat(); renderChat(); } }
      else if (e.type === 'refus') { const m = msgs.find(x => x.cle === e.cle); if (m) { m.wait = false; m.rate = true; renderChat(); } }
    };
    ws.onclose = () => {
      if (chatWs !== ws) return;
      chatWs = null; presents = [];
      // Jamais ouvert : pas de WebSocket ici (BAT Studio local) → on relève. Sinon on se reconnecte, de plus en plus calmement.
      if (!ouvert && chatEssais === 0) return sonder();
      chatMode = 'coupe'; majEtat();
      chatRetry = setTimeout(connecter, Math.min(15000, 1000 * 2 ** chatEssais++));
    };
  }
  async function relire(){
    try {
      const dernier = msgs.filter(m => !m.wait && !m.rate).at(-1);
      const r = await fetch(`${BAT}/api/chat?qui=${encodeURIComponent(me()?.id || '')}${dernier ? '&depuis=' + encodeURIComponent(dernier.id) : ''}`, { cache: 'no-store' });
      if (!r.ok) return;
      const { messages = [], pauses: pz } = await r.json();
      if (pz && JSON.stringify(pz) !== JSON.stringify(pauses)) { pauses = pz; majPause(); }
      messages.forEach(recevoir);
    } catch (_) {}
  }
  function sonder(){
    chatMode = 'sonde'; majEtat(); relire();
    chatSonde = setInterval(() => { if (!document.hidden || Date.now() % 15000 < 2500) relire(); }, 2500);
  }

  // --- Écrire ---
  // --- À qui ---
  function choisirPour(id){
    const p = me();
    chatPour = id && id !== 'tous' && id !== p?.id && profilDe(id) ? id : 'tous';
    renderChat(); lireTout();
    if (chatPos.ouvert && matchMedia('(hover:hover)').matches && !enregistreur) chatTxt.focus({ preventScroll: true });
  }
  function renderPour(){
    const p = me(); if (!p) return;
    const choix = [{ id: 'tous', name: 'Équipe', tint: '74,98,116' }, ...PROFILES.filter(x => x.id !== p.id)];
    $('#chat-pour').replaceChildren(...choix.map(x => {
      const b = el('button', (x.id === 'tous' ? 'tous' : '') + (presents.includes(x.id) ? ' en-ligne' : '') + (enPause(x.id) ? ' en-pause' : '')); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-checked', String(chatPour === x.id)); b.setAttribute('aria-selected', String(chatPour === x.id));
      b.style.setProperty('--a', '74,98,116');
      const n = nonLus(x.id);
      b.title = (x.id === 'tous' ? 'L’équipe' : x.name + (enPause(x.id) ? ` · en pause jusqu’à ${heure(pauses[x.id])}` : presents.includes(x.id) ? ' · en ligne' : '')) + (n ? ` · ${n} non lu${n > 1 ? 's' : ''}` : '');
      const s = el('span');
      if (x.id === 'tous') s.innerHTML = SVG('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.2 3.2 0 0 1 0 6.2"/><path d="M18 14.5a6 6 0 0 1 3 5.5"/>');
      else s.append(avatar(x));
      const nom = el('i', 'nom'); nom.textContent = x.name; s.append(nom);
      b.append(s);
      if (n && chatPour !== x.id) { const c = el('span', 'fil-n'); c.textContent = n > 9 ? '9+' : String(n); b.append(c); }
      b.onclick = () => choisirPour(x.id);
      return b;
    }));
    const dest = profilDe(chatPour);
    chat.classList.toggle('prive', !!dest);
    if (!dest) chatUrgent = false;
    $('#chat-urg').hidden = !dest; $('#chat-urg').setAttribute('aria-pressed', String(chatUrgent));
    chat.classList.toggle('urgent', chatUrgent);
    chatTxt.placeholder = !dest ? 'Écrire à l’équipe…' : chatUrgent ? `Urgent pour ${dest.name}…` : `Écrire à ${dest.name}…`;
  }

  // --- Envoyer (texte ou note vocale) ---
  const nouvelleCle = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function partir(m, corps){
    const p = me();
    if (chatWs && chatWs.readyState === 1) {
      chatWs.send(JSON.stringify({ type: 'msg', ...corps, cle: m.cle }));
      setTimeout(() => { if (m.wait) { m.wait = false; m.rate = true; renderChat(); } }, 10000);
      return;
    }
    fetch(`${BAT}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ de: p.id, ...corps, cle: m.cle }) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ msg }) => recevoir(msg))
      .catch(() => { m.wait = false; m.rate = true; renderChat(); });
  }
  // Urgent : une fois parti, le bouton se relâche (le suivant redevient discret).
  function prendreUrgent(pour){
    const u = chatUrgent && pour !== 'tous';
    if (chatUrgent) { chatUrgent = false; renderPour(); }
    if (u && enPause(pour)) toast(`${profilDe(pour)?.name} est en pause jusqu’à ${heure(pauses[pour])} : ton message urgent s’affichera à la fin.`);
    return u;
  }
  function envoyer(texte, pour = chatPour, urgent = prendreUrgent(pour)){
    const p = me(); texte = texte.trim(); if (!p || !texte) return;
    const cle = nouvelleCle();
    const m = { id: cle, cle, de: p.id, pour, texte, at: new Date().toISOString(), wait: true };
    if (urgent) m.urgent = true;
    msgs.push(m); renderChat();
    partir(m, { texte, pour, urgent });
  }
  async function envoyerVocal(blob, duree, pour = chatPour, urgent = prendreUrgent(pour)){
    const p = me(); if (!p || !blob) return;
    const cle = nouvelleCle(), local = URL.createObjectURL(blob);
    const m = { id: cle, cle, de: p.id, pour, texte: '', vocal: { id: null, duree, url: local }, _blob: blob, at: new Date().toISOString(), wait: true };
    if (urgent) m.urgent = true;
    msgs.push(m); renderChat();
    try {
      const r = await fetch(`${BAT}/api/chat/vocal`, { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
      if (!r.ok) throw 0;
      const { id } = await r.json();
      sons.set(id, local);   // déjà là : on ne la retélécharge pas
      partir(m, { texte: '', pour, urgent, vocal: { id, duree } });
    } catch (_) { m.wait = false; m.rate = true; renderChat(); }
  }

  // --- Écouter une note vocale ---
  const sons = new Map();   // id → adresse locale du son (téléchargé une fois)
  const lecteur = new Audio(); let enLecture = null;
  const PLAY = '<path d="M8 5.5v13l11-6.5z"/>', PAUSE = '<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>';
  const duree = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // Une onde propre à chaque note (tirée de son id) : toutes ne se ressemblent pas.
  function onde(graine, n = 26){
    let h = 0; for (const c of String(graine)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: n }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; const base = .25 + ((h >>> 8) % 1000) / 1000 * .75; return Math.round((i < 2 || i > n - 3 ? base * .5 : base) * 100); });
  }
  function lecteurVocal(m){
    const v = m.vocal, w = el('div', 'chat-voc');
    const btn = el('button', 'chat-play'); btn.type = 'button'; btn.setAttribute('aria-label', 'Écouter la note vocale');
    btn.innerHTML = SVG(enLecture?.m === m.id && !lecteur.paused ? PAUSE : PLAY);
    const barres = el('span', 'chat-onde'); barres.setAttribute('aria-hidden', 'true');
    barres.append(...onde(v.id || m.cle).map(h => { const i = el('i'); i.style.height = h + '%'; return i; }));
    const t = el('span', 'chat-voc-t'); t.textContent = duree(v.duree || 0);
    w.append(btn, barres, t);
    w.dataset.m = m.id;
    btn.onclick = async e => {
      e.stopPropagation();
      if (enLecture?.m === m.id) { lecteur.paused ? lecteur.play() : lecteur.pause(); return; }
      let url = v.url || sons.get(v.id);
      if (!url) {
        btn.disabled = true;
        try { const r = await fetch(`${BAT}/api/chat/vocal/${v.id}`); if (!r.ok) throw 0; url = URL.createObjectURL(await r.blob()); sons.set(v.id, url); }
        catch (_) { toast('Note vocale introuvable.'); btn.disabled = false; return; }
        btn.disabled = false;
      }
      enLecture = { m: m.id, duree: v.duree };
      lecteur.src = url; lecteur.play().catch(() => {});
    };
    return w;
  }
  function majLecture(){
    root.querySelectorAll('.chat-voc').forEach(w => {
      const actif = enLecture?.m === w.dataset.m;
      w.querySelector('.chat-play').innerHTML = SVG(actif && !lecteur.paused ? PAUSE : PLAY);
      const total = (isFinite(lecteur.duration) && lecteur.duration) || enLecture?.duree || 1;
      const part = actif ? lecteur.currentTime / total : 0;
      const bars = w.querySelectorAll('.chat-onde i');
      bars.forEach((b, k) => b.classList.toggle('lu', actif && k / bars.length < part));
      if (actif) w.querySelector('.chat-voc-t').textContent = duree(lecteur.paused && !lecteur.currentTime ? total : lecteur.currentTime);
    });
  }
  ['play', 'pause', 'timeupdate'].forEach(t => lecteur.addEventListener(t, majLecture));
  lecteur.addEventListener('ended', () => { const fini = enLecture; enLecture = null; majLecture(); if (fini) { const w = root.querySelector(`.chat-voc[data-m="${CSS.escape(fini.m)}"] .chat-voc-t`); if (w) w.textContent = duree(fini.duree || 0); } });

  // --- Enregistrer une note vocale : un toucher pour commencer, ↑ pour l'envoyer, la corbeille pour l'oublier ---
  const MAX_VOCAL = 180;
  let enregistreur = null, flux = null, morceaux = [], debutRec = 0, minuterieRec = null, analyseur = null, ctxRec = null, annule = false;
  const formatRec = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  function modeSaisie(){
    const rec = !!enregistreur, texte = !!chatTxt.value.trim();
    $('#chat-rec').hidden = !rec; chatTxt.hidden = rec;
    $('#chat-mic').hidden = rec || texte || !window.MediaRecorder;
    chatSend.hidden = !(rec || texte);
    chatSend.setAttribute('aria-label', rec ? 'Envoyer la note vocale' : 'Envoyer');
  }
  async function commencerVocal(){
    if (enregistreur) return;
    try { flux = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (_) { toast('Micro refusé. Autorise le micro pour ce site dans le navigateur.'); return; }
    const type = formatRec();
    enregistreur = new MediaRecorder(flux, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
    morceaux = []; annule = false; debutRec = Date.now();
    enregistreur.ondataavailable = e => { if (e.data.size) morceaux.push(e.data); };
    enregistreur.onstop = () => {
      const secondes = Math.round((Date.now() - debutRec) / 1000), blob = new Blob(morceaux, { type: (enregistreur.mimeType || type || 'audio/webm').split(';')[0] });
      flux.getTracks().forEach(t => t.stop()); flux = null; enregistreur = null;
      clearInterval(minuterieRec); try { ctxRec?.close(); } catch (_) {} ctxRec = analyseur = null;
      modeSaisie();
      if (!annule && blob.size && secondes >= 1) envoyerVocal(blob, secondes);
      else if (!annule) toast('Note trop courte : garde le micro une seconde au moins.');
    };
    enregistreur.start(250);
    // Le niveau du micro, en barres qui défilent.
    const onde = $('#chat-rec-onde'); onde.replaceChildren();
    try {
      ctxRec = new (window.AudioContext || window.webkitAudioContext)();
      analyseur = ctxRec.createAnalyser(); analyseur.fftSize = 256;
      ctxRec.createMediaStreamSource(flux).connect(analyseur);
    } catch (_) {}
    const tampon = new Uint8Array(128);
    minuterieRec = setInterval(() => {
      const s = (Date.now() - debutRec) / 1000;
      $('#chat-rec-t').textContent = duree(s);
      if (analyseur) {
        analyseur.getByteTimeDomainData(tampon);
        let m = 0; for (const v of tampon) m = Math.max(m, Math.abs(v - 128));
        const i = el('i'); i.style.height = Math.max(3, Math.min(28, m / 2.6)) + 'px'; onde.append(i);
        while (onde.children.length > 60) onde.firstChild.remove();
      }
      if (s >= MAX_VOCAL) finirVocal();
      if (chatWs?.readyState === 1 && Date.now() - derniereTape > 2500) { derniereTape = Date.now(); chatWs.send(JSON.stringify({ type: 'tape', pour: chatPour })); }
    }, 100);
    modeSaisie();
  }
  function finirVocal(oublier){ if (!enregistreur) return; annule = !!oublier; enregistreur.stop(); }
  $('#chat-mic').onclick = commencerVocal;
  $('#chat-rec-x').onclick = () => finirVocal(true);

  const ajuster = () => { chatTxt.style.height = 'auto'; chatTxt.style.height = Math.min(132, chatTxt.scrollHeight + 2) + 'px'; modeSaisie(); };
  chatTxt.addEventListener('input', () => {
    ajuster();
    if (chatTxt.value.trim() && chatWs?.readyState === 1 && Date.now() - derniereTape > 2500) { derniereTape = Date.now(); chatWs.send(JSON.stringify({ type: 'tape', pour: chatPour })); }
  });
  // Entrée envoie, Maj+Entrée va à la ligne (au doigt, le bouton envoie).
  chatTxt.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover)').matches) { e.preventDefault(); $('#chat-form').requestSubmit(); } });
  $('#chat-form').onsubmit = e => { e.preventDefault(); if (enregistreur) return finirVocal(); const t = chatTxt.value; chatTxt.value = ''; ajuster(); envoyer(t); };
  chatList.addEventListener('scroll', () => { if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 40) lireTout(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    lireTout();
    if (!chatWs && chatMode !== 'sonde' && me()) connecter();
  });

  // --- Un message privé pour moi : il s'impose à l'écran jusqu'à « J'ai lu » ---
  // Pas de fermeture possible (ni Échap, ni clic à côté) ; une note vocale s'écoute jusqu'au bout avant.
  // Le ding-dong revient toutes les 20 s tant que ce n'est pas confirmé.
  const lireDlg = $('#lire'), lireOk = $('#lire-ok');
  let lireCourant = null, lireDing = null, titreAvant = document.title, dernierJoue = null;
  lireDlg.addEventListener('cancel', e => e.preventDefault());
  lecteur.addEventListener('play', () => { dernierJoue = enLecture?.m; });
  lecteur.addEventListener('ended', () => { if (lireCourant && dernierJoue === lireCourant.id) { lireOk.disabled = false; lireOk.textContent = 'J’ai écouté'; } });
  const enAttenteDeMoi = () => { const p = me(); return p && !enPause(p.id) ? msgs.filter(m => m.urgent && m.pour === p.id && m.de !== p.id && m.lu === null && !m.wait) : []; };
  function aLire(){
    const file = enAttenteDeMoi();
    if (lireCourant && !file.some(m => m.id === lireCourant.id)) lireCourant = null;
    if (!file.length) { if (lireDlg.open) lireDlg.close(); clearInterval(lireDing); lireDing = null; document.title = titreAvant; return; }
    $('#lire-n').textContent = file.length > 1 ? `Encore ${file.length - 1} message${file.length > 2 ? 's' : ''} après celui-ci` : '';
    if (lireCourant) return;
    const m = lireCourant = file[0], de = profilDe(m.de);
    lireDlg.style.setProperty('--a', de ? de.tint : '74,98,116');
    const av = de ? avatar(de) : el('span', 'avatar'); av.id = 'lire-av'; $('#lire-av').replaceWith(av);
    $('#lire-de').textContent = `${de ? de.name : '?'} t’écrit`;
    $("#lire-quand").textContent = `Urgent · ${heure(m.at)}`;
    const box = $('#lire-txt');
    if (m.vocal) { box.replaceChildren(lecteurVocal(m)); lireOk.disabled = true; lireOk.textContent = 'Écoute la note jusqu’au bout'; }
    else { box.textContent = m.texte; lireOk.disabled = false; lireOk.textContent = 'J’ai lu'; }
    if (!lireDlg.open) lireDlg.showModal();
    lireOk.focus();
    sonner();
    clearInterval(lireDing); lireDing = setInterval(sonner, 20000);
    document.title = `🔴 ${de ? de.name : 'Message'} t’écrit`;
  }
  lireOk.onclick = () => {
    const m = lireCourant, p = me(); if (!m || !p) return;
    if (enLecture?.m === m.id) lecteur.pause();
    confirmerLu(m);
    lireCourant = null; choisirPour(m.de);   // on retombe dans sa conversation, prêt à répondre
    aLire();
  };

  $('#chat-urg').onclick = () => { chatUrgent = !chatUrgent; renderPour(); chatTxt.focus({ preventScroll: true }); };

  // --- Ne pas déranger : ni son ni fenêtre chez moi, les autres voient jusqu'à quand ---
  const menu = $('#chat-menu'), dnd = $('#chat-dnd');
  const dansMs = ms => new Date(Date.now() + ms).toISOString();
  const demainMatin = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(7, 30, 0, 0); return d.toISOString(); };
  function pauser(jusqua){
    const p = me(); if (!p) return;
    if (jusqua) pauses[p.id] = jusqua; else delete pauses[p.id];
    majPause(); menu.hidden = true;
    if (chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'pause', jusqua }));
    else fetch(`${BAT}/api/chat/pause?qui=${encodeURIComponent(p.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jusqua }) }).catch(() => {});
    toast(jusqua ? `Ne pas déranger jusqu’à ${heure(jusqua)}. Les messages urgents attendront.` : 'Tu reçois à nouveau tout.');
  }
  dnd.onclick = e => {
    e.stopPropagation();
    if (!menu.hidden) { menu.hidden = true; return; }
    const p = me(), actif = enPause(p?.id);
    const ligne = (txt, fn, cls) => { const b = el('button', cls || ''); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.textContent = txt; b.onclick = fn; return b; };
    const info = el('p'); info.textContent = actif ? `En pause jusqu’à ${heure(pauses[p.id])}.` : 'Ni son ni fenêtre. Les messages urgents s’afficheront à la fin de la pause.';
    menu.replaceChildren(info,
      ...(actif ? [ligne('Reprendre maintenant', () => pauser(null), 'fin')] : []),
      ligne('30 minutes', () => pauser(dansMs(30 * 60000))),
      ligne('1 heure', () => pauser(dansMs(3600000))),
      ligne('2 heures', () => pauser(dansMs(2 * 3600000))),
      ligne('Jusqu’à demain matin', () => pauser(demainMatin())),
      ...(DASHBOARD || !p ? [] : [ligne(`Je ne suis pas ${p.name}`, () => { menu.hidden = true; oublierQui(); }, 'fin')]));
    menu.hidden = false;
    menu.querySelector('button')?.focus();
  };
  document.addEventListener('pointerdown', e => { const t = e.composedPath()[0]; if (!menu.hidden && !menu.contains(t) && !dnd.contains(t)) menu.hidden = true; });
  menu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); menu.hidden = true; dnd.focus(); } });
  let pauseVue = '';
  function majPause(){
    const p = me(); if (!p) return;
    const moi = enPause(p.id);
    dnd.setAttribute('aria-pressed', String(moi));
    dnd.title = moi ? `Ne pas déranger jusqu’à ${heure(pauses[p.id])}` : 'Ne pas déranger';
    $('#chat-lune').hidden = !moi;
    pauseVue = JSON.stringify(Object.keys(pauses).filter(enPause));
    majEtat(); renderPour(); aLire();
  }
  // Une pause finit toute seule : on regarde chaque demi-minute (les urgents en attente s'affichent alors).
  setInterval(() => { if (JSON.stringify(Object.keys(pauses).filter(enPause)) !== pauseVue) majPause(); }, 30000);

  // ---------- La to do list : à soi, cochée ici, rayée partout (BAT Studio, /api/todo) ----------
  // Une liste par prénom, rangée chez BAT Studio : cochée sur le Dashboard, elle l'est dans chaque appli.
  // Les notifications de BAT Studio pour moi s'y ajoutent d'elles-mêmes (cocher = lu) :
  // Mélina et Loïc, un BAT validé à lancer si le client a payé ; Julien, les cotes à prendre ;
  // Charlie, la production (l'imprimante de la bulle PRT, les demandes de PRT).
  // Le clic droit (un appui long au doigt) sur la to do list ou la messagerie les cache sur ce site.
  const LS_TODO = 'olda_todo', LS_TODO_POS = 'olda_todo_pos', LS_TODO_VUS = 'olda_todo_vus', LS_CACHES = 'olda_caches';
  const todo = $('#todo'), todoOrb = $('#todo-orb'), todoPanel = $('#todo-panel'), todoList = $('#todo-list'), todoTxt = $('#todo-txt');
  const ORB_T = 56, JOUR = 864e5, BAT_ORIGINE = (() => { try { return new URL(BAT).origin; } catch (_) { return ''; } })();
  const caches = Object.assign({ todo: false, chat: false }, store.get(LS_CACHES) || {});
  // Ouverte d'office sur le Dashboard, sauf au téléphone (elle couvrirait la discussion).
  const todoPos = Object.assign({ x: null, y: null, ouvert: DASHBOARD && innerWidth >= 720 }, store.get(LS_TODO_POS) || {});
  const todoVus = new Set(store.get(LS_TODO_VUS) || []);
  let taches = [], notifsT = [], todoMinuterie = null, rayes = new Set();

  // --- Place et taille, comme la bulle de discussion ---
  const tailleT = () => todoPos.ouvert ? { w: todoPanel.offsetWidth || 340, h: todoPanel.offsetHeight || 480 } : { w: ORB_T, h: ORB_T };
  function bornerT(){
    const { w, h } = tailleT(), vw = innerWidth, vh = innerHeight;
    if (todoPos.x == null) {
      if (vw < 200 || vh < 200) return;
      // Le Dashboard l'ouvre en bas à gauche ; ailleurs, la pastille se pose au-dessus de celle de la discussion.
      if (DASHBOARD) { todoPos.x = 24; todoPos.y = vh - h - 24; } else { todoPos.x = vw - w - 28; todoPos.y = vh - ORB - 92 - h - 18; }
    }
    todoPos.x = Math.min(Math.max(MARGE, todoPos.x), Math.max(MARGE, vw - w - MARGE));
    todoPos.y = Math.min(Math.max(MARGE, todoPos.y), Math.max(MARGE, vh - h - MARGE));
  }
  function placerT(){ bornerT(); todo.style.transform = `translate3d(${Math.round(todoPos.x)}px,${Math.round(todoPos.y)}px,0)`; }
  const garderPosT = () => store.set(LS_TODO_POS, todoPos);
  function basculerT(ouvrir){
    if (ouvrir === todoPos.ouvert) return;
    const vw = innerWidth, vh = innerHeight;
    if (ouvrir) {
      const droite = todoPos.x + ORB_T / 2 > vw / 2, bas = todoPos.y + ORB_T / 2 > vh / 2;
      todoPos.ouvert = true; todo.classList.remove('is-min');
      const { w, h } = tailleT();
      todoPanel.style.setProperty('--ox', droite ? '100%' : '0'); todoPanel.style.setProperty('--oy', bas ? '100%' : '0');
      todoPos.x = droite ? todoPos.x + ORB_T - w : todoPos.x; todoPos.y = bas ? todoPos.y + ORB_T - h : todoPos.y;
      placerT(); devant(todo); todoOrb.classList.remove('has-new'); relireT();
      if (matchMedia('(hover:hover)').matches) todoTxt.focus({ preventScroll: true });
    } else {
      const { w, h } = tailleT();
      const droite = todoPos.x + w / 2 > vw / 2, bas = todoPos.y + h / 2 > vh / 2;
      todoPos.ouvert = false; todo.classList.add('is-min');
      todoPos.x = droite ? todoPos.x + w - ORB_T : todoPos.x; todoPos.y = bas ? todoPos.y + h - ORB_T : todoPos.y;
      placerT();
    }
    garderPosT(); majCompteT();
  }
  let glisseT = null, vientDeGlisserT = false;
  function priseT(e){
    const bt = e.target.closest('button');
    if (e.button > 0 || (bt && bt !== e.currentTarget)) return;
    glisseT = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: todoPos.x, py: todoPos.y, bouge: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function deplacerT(e){
    if (!glisseT || e.pointerId !== glisseT.id) return;
    const dx = e.clientX - glisseT.x0, dy = e.clientY - glisseT.y0;
    if (!glisseT.bouge && Math.hypot(dx, dy) < 3) return;
    if (!glisseT.bouge) { glisseT.bouge = true; todo.classList.add('drag'); todo.style.transition = 'none'; }
    todoPos.x = glisseT.px + dx; todoPos.y = glisseT.py + dy;
    placerT();
  }
  function lacherT(e){
    if (!glisseT || e.pointerId !== glisseT.id) return;
    const bouge = glisseT.bouge; glisseT = null; todo.classList.remove('drag');
    if (!bouge) return;
    vientDeGlisserT = true; setTimeout(() => { vientDeGlisserT = false; }, 0);
    bornerT();
    const { w, h } = tailleT(), dX = innerWidth - w - MARGE, dY = innerHeight - h - MARGE;
    const colle = v => v - MARGE < AIMANT ? MARGE : null;
    const x = colle(todoPos.x) ?? (dX - todoPos.x < AIMANT ? dX : todoPos.x);
    const y = colle(todoPos.y) ?? (dY - todoPos.y < AIMANT ? dY : todoPos.y);
    todo.style.transition = (x !== todoPos.x || y !== todoPos.y) && !reduced.matches ? 'transform .45s cubic-bezier(.34,1.4,.64,1)' : '';
    todoPos.x = x; todoPos.y = y;
    placerT(); garderPosT();
  }
  for (const poignee of [todoOrb, $('#todo-head')]) {
    poignee.addEventListener('pointerdown', priseT);
    poignee.addEventListener('pointermove', deplacerT);
    poignee.addEventListener('pointerup', lacherT);
    poignee.addEventListener('pointercancel', lacherT);
  }
  todo.addEventListener('transitionend', () => { todo.style.transition = ''; });
  // Celle qu'on touche ou qu'on ouvre passe devant l'autre.
  // Au-dessus de tout, comme la messagerie ; des deux, celle qu'on touche passe devant.
  const devant = n => { todo.style.zIndex = n === todo ? 36 : 35; chat.style.zIndex = n === chat ? 36 : 35; };
  todo.addEventListener('pointerdown', () => devant(todo), true);
  chat.addEventListener('pointerdown', () => devant(chat), true);
  todoOrb.onclick = () => { if (!vientDeGlisserT && !appuiLongPris()) basculerT(true); };
  $('#todo-x').onclick = () => basculerT(false);
  todoPanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); basculerT(false); todoOrb.focus(); } });

  // --- UNE NOTIFICATION, UNE LIGNE (22/11/2026) : qui a fait quoi, pour quel client. ---
  // Ni étiquette ni détails : la réponse (« Fait », « Oui, payé »…) reste en dessous.
  // Un nom de client trop long tient en ses initiales : « Le temps des cerises » → « LTC ».
  const PETITS = new Set(['de', 'des', 'du', 'd', 'la', 'le', 'les', 'l', 'et', 'à', 'a', 'au', 'aux', 'en', '&']);
  function nomCourt(nom){
    const n = String(nom).trim();
    if (n.length <= 14) return n;
    const mots = n.replace(/\([^)]*\)/g, ' ').split(/[\s'’-]+/).filter(m => /\p{L}|\d/u.test(m));
    const gardes = mots.filter((m, i) => i === 0 || !PETITS.has(m.toLowerCase()));
    const sigle = gardes.map(m => m.match(/[\p{L}\d]/u)[0]).join('').toUpperCase();
    return sigle.length >= 2 ? sigle : n;
  }
  function ligneNotif(n, court = true){
    const t = String(n.titre || ''), x = String(n.texte || '');
    const raccourcir = v => (court ? nomCourt(v) : String(v).trim()).toLocaleUpperCase('fr');   // les clients, toujours en majuscules
    const avant = t.replace(/^Rappel — /, '').split(' : ')[0];
    const client = raccourcir(avant.split(' · ')[0].replace(/\s*\(Pro\)$/, '')) || 'un client';
    // L'auteur : celui que la notification nomme, sinon celui que son ancien texte citait.
    const nomme = profilDe(n.de)?.name
      || (n.type === 'prt-imprimer' && x.match(/^Cotes prises par ([^:]+?) :/)?.[1])
      || (n.type === 'prt-shop' && x.match(/ — ([^—]+)$/)?.[1]?.trim()) || '';
    switch (n.type) {
      case 'bat-valide':
        if (/ : payé, en PRT$/.test(t)) return `${nomme || 'Le bureau'} a validé le paiement de ${client}`;
        if (/ : lancé en production, en PRT$/.test(t)) return `${nomme || 'Le bureau'} a lancé ${client} en production`;
        return `${client} a validé son BAT`;
      case 'bat-paiement': case 'bat-production': return `${client} a validé son BAT`;
      case 'bat-note': return `${client} a laissé une note sur son BAT`;
      case 'bat-relance': return `${client} n’a pas répondu au BAT`;
      case 'prt-imprimer': return nomme ? `${nomme} a validé les cotes de ${client}` : `Cotes prises pour ${client}`;
      case 'prt-shop': return nomme ? `${nomme} a demandé un réassort boutique` : 'Réassort boutique demandé';
      case 'presse-pret': return `${client} est imprimé, à presser`;
      case 'presse-fini': case 'a-facturer': return `La commande ${client} est terminée`;
      // Une référence finie, la commande pas complète (planning, 22/11/2026) : le texte dit laquelle et ce qui reste.
      case 'ref-finie': return x ? `${client} : ${x.replace(/\s*\(reste [^)]*\)$/, '')}` : `${client} : une référence terminée, commande pas complète`;
      case 'shop-fini': return 'Réassort boutique terminé';
      // Un vêtement sous le stock minimum (22/11/2026) : « NS300 · Noir · M : à recommander ».
      case 'stock-bas': return t;
      // Des articles d'un BAT jamais en stock (22/11/2026) : « MANGO BEACH : 2 articles pas en stock ».
      case 'stock-manque': return t;
      case 'retards': {
        const tot = +(t.match(/^\d+/)?.[0] || 0), r = (x.match(/de retard\)/g) || []).length, d = tot - r;
        const cmd = k => `${k} commande${k > 1 ? 's' : ''}`;
        if (!tot) return t;
        // Un seul client : on le nomme.
        if (tot === 1) {
          const m = x.match(/^(.*?) \(([^)]*)\)$/), qui = raccourcir((m?.[1] || '').split(' · ')[0]);
          if (qui) return r ? `${qui} est en retard` : `${qui} est à livrer ${m[2]}`;
        }
        return r && d ? `${cmd(r)} en retard, ${d} urgente${d > 1 ? 's' : ''}` : r ? `${cmd(r)} en retard` : `${cmd(d)} urgente${d > 1 ? 's' : ''}`;
      }
      default: return t;
    }
  }

  // --- Afficher ---
  const notifsVisibles = () => notifsT.filter(n => !n.lu || Date.now() - Date.parse(n.lu) < JOUR);
  const aFaire = () => taches.filter(t => !t.fait).length + notifsT.filter(n => !n.lu).length;
  function majCompteT(){
    const n = aFaire(), c = $('#todo-n');
    c.hidden = !n || todoPos.ouvert; c.textContent = n > 9 ? '9+' : String(n);
    $('#todo-c').textContent = n ? `${n} à faire` : '';
    todoOrb.setAttribute('aria-label', n ? `Ma to do list : ${n} à faire` : 'Ouvrir ma to do list');
  }
  function ligneT({ texte, quand, fait, cocher, ouvrir, suppr, actions }){
    const li = el('li', 'todo-i' + (fait ? ' fait' : ''));
    const c = el('button', 'todo-cc'); c.type = 'button'; c.setAttribute('role', 'checkbox'); c.setAttribute('aria-checked', String(!!fait));
    c.setAttribute('aria-label', texte); c.innerHTML = SVG('<circle cx="12" cy="12" r="8.5"/><path class="v" d="M7.5 12.5l3 3 6-7"/>');
    if (cocher) c.onclick = cocher; else c.disabled = true;
    const corps = el('div', 'todo-corps');
    const tx = el('span', 'todo-tx'), sp = el('span'); sp.textContent = texte; tx.append(sp); corps.append(tx);
    // Reçue quand : « Aujourd’hui à 14:32 », « Hier à 09:10 », « samedi 21 novembre à 18:05 ».
    if (quand && !isNaN(Date.parse(quand))) { const q = el('time', 'todo-quand'); q.dateTime = quand; q.textContent = `${jour(quand)} à ${heure(quand)}`; corps.append(q); }
    if (actions?.length) { const a = el('div', 'todo-acts'); a.append(...actions); corps.append(a); }
    li.append(c, corps);
    if (ouvrir) { const o = el('button', 'todo-ic'); o.type = 'button'; o.title = 'Ouvrir'; o.setAttribute('aria-label', 'Ouvrir : ' + texte); o.innerHTML = SVG('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'); o.onclick = ouvrir; li.append(o); }
    if (suppr) { const d = el('button', 'todo-ic'); d.type = 'button'; d.title = 'Supprimer'; d.setAttribute('aria-label', 'Supprimer : ' + texte); d.innerHTML = SVG('<path d="M6 6l12 12M18 6L6 18"/>'); d.onclick = suppr; li.append(d); }
    return li;
  }
  function renderTodo(){
    const p = me(); if (!p) return;
    const out = [];
    for (const n of notifsVisibles()) {
      const li = ligneT({ texte: ligneNotif(n), quand: n.at, fait: !!n.lu, cocher: n.lu ? null : () => cocherNotif(n), actions: boutonsNotif(n) });
      const entier = ligneNotif(n, false);
      if (entier !== ligneNotif(n)) li.querySelector('.todo-tx').title = entier;   // le nom complet, au survol
      if (rayes.has(n.id)) li.classList.add('raye');
      out.push(li);
    }
    for (const t of taches) {
      const li = ligneT({ texte: t.texte, fait: !!t.fait, cocher: () => cocherTache(t), suppr: t.fait ? () => supprimerTache(t) : null });
      if (rayes.has(t.id)) li.classList.add('raye');
      out.push(li);
    }
    if (!out.length) { const v = el('li', 'todo-vide'); v.textContent = 'Rien à faire. Profites-en ✌️'; out.push(v); }
    todoList.replaceChildren(...out);
    rayes = new Set();
    const finies = taches.filter(t => t.fait).length, vider = $('#todo-vider');
    vider.hidden = !finies; vider.textContent = `Effacer les terminées (${finies})`;
    majCompteT();
  }

  // --- Mes tâches : sur l'appareil tout de suite, chez BAT Studio dans la foulée ---
  const nouvelId = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function sauverT(){
    store.set(LS_TODO, { qui: me()?.id, items: taches, aEnvoyer: true, v: Date.now() + Math.random() });
    clearTimeout(todoMinuterie); todoMinuterie = setTimeout(envoyerT, 400);
    renderTodo();
  }
  async function envoyerT(){
    const c = store.get(LS_TODO);
    if (!c || !c.aEnvoyer || !profil(c.qui)) return;
    try {
      const r = await fetch(`${BAT}/api/todo?qui=${encodeURIComponent(c.qui)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: c.items }) });
      if (!r.ok) throw 0;
      const d = store.get(LS_TODO);
      if (d && d.v === c.v) store.set(LS_TODO, { ...d, aEnvoyer: false });
    } catch (_) { /* hors-ligne : la liste reste sur l'appareil, elle repartira */ }
  }
  $('#todo-add').onsubmit = e => {
    e.preventDefault();
    const v = todoTxt.value.replace(/\s+/g, ' ').trim().slice(0, 300); if (!v) return;
    if (taches.length >= 200) return toast('200 tâches au plus : efface les terminées.');
    taches.unshift({ id: nouvelId(), texte: v, at: new Date().toISOString(), fait: null });
    todoTxt.value = ''; sauverT(); todoList.scrollTop = 0;
  };
  function cocherTache(t){ t.fait = t.fait ? null : new Date().toISOString(); if (t.fait) rayes.add(t.id); sauverT(); }
  function supprimerTache(t){ taches = taches.filter(x => x !== t); sauverT(); }
  $('#todo-vider').onclick = () => { taches = taches.filter(t => !t.fait); sauverT(); };

  // --- Les notifications pour moi : cocher = lu ---
  function cocherNotif(n){
    if (n.lu) return;
    n.lu = new Date().toISOString(); rayes.add(n.id); renderTodo();
    fetch(`${BAT}/api/notifs/${encodeURIComponent(n.id)}/lu`, { method: 'POST' }).catch(() => {});
  }
  // LA RÉPONSE EN UN CLIC (21/11/2026) : « tout le travail doit être déjà mâché, on n'a plus qu'à
  // cliquer ». Chaque notification arrive avec sa question et ses réponses ; répondre la coche.
  const PLANNING = 'https://planning-olda.dockbear.workers.dev/';
  const PLANCHE = 'http://127.0.0.1:47831/bat';   // la Planche DTF de Fast White, sur le poste
  function ouvrirBatT(lien){
    let u; try { u = new URL(lien || '/', BAT + '/'); } catch (_) { return; }
    if (u.origin !== BAT_ORIGINE) return;   // le lien ne mène que chez BAT Studio
    u.searchParams.set('poste', me()?.id || '');
    window.open(u.toString(), '_blank', 'noopener');
  }
  const ouvrirPlanningT = () => window.open(PLANNING, '_blank', 'noopener');
  // direct : « Envoyer en production » — la Planche crée le PRT d'elle-même (rien d'autre sur la planche).
  const ouvrirPlancheT = (c, direct) => window.open(`${PLANCHE}?id=${encodeURIComponent(c.id)}&zone=${encodeURIComponent(c.zone)}${direct ? '&auto=1' : ''}`, '_blank', 'noopener');
  // « Le client a-t-il payé ? » — Oui : la bulle part dans PRT, cotes à prendre ; Non : la ligne reste
  // en rouge en haut du Dashboard. Le serveur coche aussi la question de l'autre (Mélina / Loïc).
  async function payerT(n, paye){
    const r = await fetch(`${BAT}/api/suivi/${encodeURIComponent(n.projetId)}/paiement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paye, qui: me()?.id || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 404) throw new Error(j.error || 'Erreur ' + r.status);   // 404 : déjà réglé
    toast(n.type === 'bat-production'
      ? (paye ? 'En production : la bulle est dans PRT, cotes à prendre.' : 'Noté : la question reviendra demain matin.')
      : (paye ? 'Payé : la bulle est dans PRT, cotes à prendre.' : 'Noté : non payé, la question reviendra demain matin.'));
  }
  async function prevenuT(n){
    if (!n.carte?.id) return;   // une notification d'avant : rien à ranger
    const r = await fetch(`${BAT}/api/suivi/${encodeURIComponent(n.carte.id)}/prevenu`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    toast('Client prévenu : la commande est aux Archives.');
  }
  // À RECOMMANDER (22/11/2026) : +5/10/15 ajoute au bon de commande du Stock textile, Vu l'oublie.
  // L'un répond, c'est coché chez l'autre (Loïc / Mélina) et retiré du Stock textile.
  async function stockT(n, chemin, corps){
    const r = await fetch(`${BAT}/api/stock/${chemin}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cle: n.stockCle, par: me()?.name || '', ...corps }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    if (corps.n) toast(`+${corps.n} au bon de commande.`);
  }
  async function manqueT(n, reponse){
    const r = await fetch(`${BAT}/api/stock/manque`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bat: n.stockBat, reponse, par: me()?.name || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    if (reponse === 'commande') toast('Ajouté au bon de commande TopTex.');
  }
  // Le texte prêt à coller (le lien du client, le message « commande prête »).
  async function copierT(n){
    try { await navigator.clipboard.writeText(n.copie); }
    catch (_) { const t = document.createElement('textarea'); t.value = n.copie; document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); if (!ok) throw new Error('Copie refusée par le navigateur.'); }
    toast('Copié : colle-le dans WhatsApp.');
  }
  // Ce que demande la notification : [{ label, cls, fn }] ; une réponse coche la ligne.
  function reponsesNotif(n){
    const planning = { label: 'Ouvrir le planning', cls: 'go', fn: ouvrirPlanningT };
    switch (n.type) {
      case 'bat-paiement': return n.projetId
        ? [{ label: 'Oui, payé', cls: 'oui', fn: () => payerT(n, true) }, { label: 'Non', cls: 'non', fn: () => payerT(n, false) }]
        : [];
      case 'bat-production': return n.projetId
        ? [{ label: 'Oui, en production', cls: 'oui', fn: () => payerT(n, true) }, { label: 'Pas encore', cls: 'non', fn: () => payerT(n, false) }]
        : [];
      case 'bat-relance': return n.copie ? [{ label: 'Copier le lien', cls: 'go', fn: () => copierT(n) }] : [];
      case 'a-facturer': return [{ label: 'Facturé', cls: 'oui', fn: () => {} }];
      case 'retards': return [planning];
      case 'bat-valide': return [{ label: 'Prendre les cotes', cls: 'go', fn: () => ouvrirBatT(n.lien) }];
      case 'bat-note': return [{ label: 'Refaire le BAT', cls: 'go', fn: () => ouvrirBatT(n.projetId ? `/?projet=${encodeURIComponent(n.projetId)}` : n.lien) }];
      case 'prt-imprimer': return n.carte
        ? [{ label: 'En production', cls: 'oui', fn: () => ouvrirPlancheT(n.carte, true) }, { label: 'Planning', fn: ouvrirPlanningT }]
        : [planning];
      case 'prt-shop': return [planning];
      case 'presse-pret': return [{ ...planning, label: 'Ouvrir la presse' }];
      // « Client prévenu » range la bulle du planning : de Terminé aux Archives.
      // Mélina et Loïc n'ont que ce bouton à toucher (22/11/2026) ; l'un répond, c'est coché chez l'autre.
      case 'presse-fini': return [{ label: 'Client prévenu', cls: 'oui', fn: () => prevenuT(n) }];
      case 'shop-fini': return [{ label: 'Vu', cls: 'oui', fn: () => {} }];
      // « Ajouter à la commande » : les articles partent dans le bon TopTex, au nom du client.
      case 'stock-manque': return n.stockBat
        ? [{ label: 'Ajouter à la commande', cls: 'oui', fn: () => manqueT(n, 'commande') }, { label: 'Non', fn: () => manqueT(n, 'non') }]
        : [];
      case 'stock-bas': return n.stockCle
        ? [5, 10, 15].map(k => ({ label: `+${k}`, cls: k === 10 ? 'oui' : '', fn: () => stockT(n, 'bon', { n: k }) }))
          .concat({ label: 'Vu', fn: () => stockT(n, 'vu', {}) })
        : [];
      default: return n.lien && n.lien !== '/' ? [{ label: 'Ouvrir', cls: 'go', fn: () => ouvrirBatT(n.lien) }] : [];
    }
  }
  const FAIT = { 'prt-imprimer': 'Envoyé', 'bat-paiement': 'Répondu', 'bat-production': 'Répondu', 'bat-relance': 'Lien copié', 'presse-fini': 'Client prévenu', 'shop-fini': 'Vu', 'a-facturer': 'Facturé', 'stock-bas': 'Traité', 'stock-manque': 'Répondu' };
  function boutonsNotif(n){
    const liste = reponsesNotif(n);
    if (!liste.length) return [];
    if (n.lu) {
      const f = el('span', 'todo-act ok'); f.innerHTML = SVG('<path d="M5 12.5l4.5 4.5L19 7.5"/>');
      f.append(FAIT[n.type] || 'Fait');
      // RENVOYER (22/11/2026) : un PRT mal parti (Planche fermée, envoi raté) se renvoie d'ici.
      // La Planche remplace le PRT de ce BAT, jamais de doublon.
      if (n.type === 'prt-imprimer' && n.carte) {
        const r = el('button', 'todo-act go'); r.type = 'button'; r.textContent = r.title = 'Renvoyer';
        r.onclick = () => { ouvrirPlancheT(n.carte, true); toast('Renvoyé à la Planche : le PRT se recrée.'); };
        return [f, r];
      }
      return [f];
    }
    return liste.map(a => {
      const b = el('button', 'todo-act ' + (a.cls || '')); b.type = 'button'; b.textContent = a.label; b.title = a.label;
      b.onclick = async () => {
        b.disabled = true;
        try { await a.fn(); cocherNotif(n); }
        catch (e) { toast(e.message || 'Réseau indisponible, réessaie.'); b.disabled = false; }
      };
      return b;
    });
  }
  function nouvellesNotifs(){
    const neuves = notifsT.filter(n => !n.lu && !todoVus.has(n.id));
    if (!neuves.length) return;
    neuves.forEach(n => todoVus.add(n.id)); store.set(LS_TODO_VUS, [...todoVus].slice(-300));
    if (!todoPos.ouvert) todoOrb.classList.add('has-new');
    $('#rappel').classList.add('neuf');
    // Les notifications n'arrivent qu'ici, dans « À faire » : la bulle sonne, rien d'autre ne s'affiche.
    const p = me();
    if (p && !enPause(p.id)) sonner();
  }

  // --- Relever : à l'ouverture, au retour sur l'onglet, et chaque demi-minute ---
  let releveT = false;
  async function relireT(){
    const p = me(); if (!p || releveT) return;
    releveT = true;
    try {
      const c = store.get(LS_TODO);
      if (c?.aEnvoyer && c.qui === p.id) await envoyerT();
      const [rt, rn] = await Promise.all([
        fetch(`${BAT}/api/todo?qui=${encodeURIComponent(p.id)}`, { cache: 'no-store' }).catch(() => null),
        fetch(`${BAT}/api/notifs?pour=${encodeURIComponent(p.id)}`, { cache: 'no-store' }).catch(() => null),
      ]);
      if (me() !== p) return;
      const d = store.get(LS_TODO);
      if (rt?.ok && !(d?.aEnvoyer && d.qui === p.id)) {
        const { items } = await rt.json().catch(() => ({}));
        if (Array.isArray(items)) { taches = items; store.set(LS_TODO, { qui: p.id, items, aEnvoyer: false, v: 0 }); }
      }
      if (rn?.ok) { const { notifs } = await rn.json().catch(() => ({})); if (Array.isArray(notifs)) { notifsT = notifs; nouvellesNotifs(); } }
      renderTodo();
    } finally { releveT = false; }
  }
  setInterval(() => { if (!document.hidden) relireT(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) relireT(); });
  addEventListener('online', relireT);

  function todoRelancer(){
    const p = me(), c = store.get(LS_TODO);
    taches = c && c.qui === p?.id && Array.isArray(c.items) ? c.items : [];
    notifsT = [];
    todo.classList.toggle('is-min', !todoPos.ouvert);
    appliquerCaches();
    if (p) { renderTodo(); relireT(); }
  }

  // --- Cacher / afficher, site par site : clic droit, ou appui long au doigt ---
  const ctx = $('#ctx'), rappel = $('#rappel');
  function appliquerCaches(){
    const p = me();
    chat.hidden = (!p && DASHBOARD) || caches.chat;
    todo.hidden = !p || caches.todo;
    rappel.hidden = !(chat.hidden && todo.hidden && (caches.chat || caches.todo));
    if (!chat.hidden) placer();
    if (!todo.hidden) placerT();
  }
  function cacher(k, v){
    caches[k] = v; store.set(LS_CACHES, caches); ctx.hidden = true;
    appliquerCaches();
    const nom = k === 'todo' ? 'La to do list' : 'La messagerie';
    toast(!v ? `${nom} est de retour.` : caches.todo && caches.chat ? 'Tout est caché sur ce site : le petit point en bas à droite les remet.' : `${nom} est cachée sur ce site. Clic droit sur l’autre pour la remettre.`);
  }
  const ICO_CACHER = '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 5 10 7a17 17 0 0 1-3.2 4.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
  const ICO_VOIR = '<path d="M2 12c1-2 5-7 10-7s9 5 10 7c-1 2-5 7-10 7S3 14 2 12z"/><circle cx="12" cy="12" r="3"/>';
  function ouvrirCtx(x, y){
    const ligne = (txt, ico, fn) => { const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.innerHTML = SVG(ico); b.append(txt); b.onclick = fn; return b; };
    ctx.replaceChildren(
      ligne(caches.todo ? 'Afficher la To do list' : 'Cacher la To do list', caches.todo ? ICO_VOIR : ICO_CACHER, () => cacher('todo', !caches.todo)),
      ligne(caches.chat ? 'Afficher la messagerie' : 'Cacher la messagerie', caches.chat ? ICO_VOIR : ICO_CACHER, () => cacher('chat', !caches.chat)));
    ctx.hidden = false;
    const w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.transform = `translate(${Math.round(Math.max(8, Math.min(x, innerWidth - w - 8)))}px,${Math.round(Math.max(8, Math.min(y, innerHeight - h - 8)))}px)`;
    ctx.querySelector('button')?.focus({ preventScroll: true });
  }
  function surClicDroit(e){
    const t = e.composedPath()[0];
    // Dans un champ, ou du texte sélectionné : le menu du navigateur (coller, copier).
    if (t?.closest?.('textarea, input') || String(root.getSelection?.() || getSelection() || '').trim()) return;
    e.preventDefault(); e.stopPropagation();
    ouvrirCtx(e.clientX, e.clientY);
  }
  for (const n of [chat, todo, rappel]) n.addEventListener('contextmenu', surClicDroit);
  rappel.onclick = () => { rappel.classList.remove('neuf'); ouvrirCtx(innerWidth, innerHeight - 52); };   // juste au-dessus du point
  document.addEventListener('pointerdown', e => { if (!ctx.hidden && !ctx.contains(e.composedPath()[0])) ctx.hidden = true; });
  ctx.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); ctx.hidden = true; } });
  // Au doigt (iPhone : pas de clic droit), un appui long sur la pastille ou l'en-tête ouvre le même menu.
  let appui = null, appuiLong = false;
  const appuiLongPris = () => { const v = appuiLong; appuiLong = false; return v; };
  for (const n of [chatOrb, $('#chat-head'), todoOrb, $('#todo-head')]) {
    n.style.webkitTouchCallout = 'none';
    n.addEventListener('pointerdown', e => {
      appuiLong = false;
      if (e.pointerType === 'mouse') return;
      clearTimeout(appui?.t);
      const x = e.clientX, y = e.clientY;
      appui = { x, y, t: setTimeout(() => { appui = null; appuiLong = true; glisse = null; glisseT = null; chat.classList.remove('drag'); todo.classList.remove('drag'); ouvrirCtx(x, y); }, 550) };
    });
    n.addEventListener('pointermove', e => { if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 10) { clearTimeout(appui.t); appui = null; } });
    for (const t of ['pointerup', 'pointercancel']) n.addEventListener(t, () => { if (appui) { clearTimeout(appui.t); appui = null; } });
  }

  function chatRelancer(){
    const p = me(); chat.classList.toggle('sans-nom', !p); todoRelancer();
    if (!p) { if (chatWs) { chatWs.onclose = null; chatWs.close(); chatWs = null; } clearInterval(chatSonde); chatSonde = null; renderQui(); placer(); return; }
    chat.classList.toggle('is-min', !chatPos.ouvert);
    // Un autre prénom au poste : on repart de sa conversation à lui (ses messages privés ne sont pas ceux d'avant).
    const c = store.get(LS_CHAT); msgs = c && c.qui === p.id && Array.isArray(c.msgs) ? c.msgs : [];
    chatPour = 'tous'; renderPour(); modeSaisie();
    lireCourant = null; chatUrgent = false; renderChat(); placer(); connecter(); majPause();
  }

  // --- Pas encore de prénom ici : on le choisit dans la bulle ---
  function renderQui(){
    chat.classList.toggle('is-min', !chatPos.ouvert);
    chatEtat.className = 'chat-etat'; chatEtat.textContent = 'Discussion de l’équipe';
    $('#chat-n').hidden = true; chatOrb.classList.remove('has-new', 'is-live'); chatOrb.querySelector('.chat-en')?.remove();
    const t = el('p', 'chat-qui-t'); t.textContent = 'Qui es-tu ?';
    const s = el('p', 'chat-qui-s'); s.textContent = 'Ton prénom signe tes messages. Il reste retenu sur cet appareil.';
    const g = el('div', 'chat-qui');
    g.append(...PROFILES.map(x => {
      const b = el('button'); b.type = 'button';
      const n = el('span'); n.textContent = x.name;
      b.append(avatar(x), n);
      b.onclick = () => { store.set(LS_WHO, x.id); chatRelancer(); toast(`Bonjour ${x.name} 👋`); if (chatPos.ouvert) chatTxt.focus({ preventScroll: true }); };
      return b;
    }));
    chatList.replaceChildren(t, s, g);
  }
  function oublierQui(){ store.del(LS_WHO); store.del('bat.poste'); chatRelancer(); }

  (document.body || document.documentElement).append(hote);
  chatRelancer();
  window.oldaBulle = { relancer: chatRelancer, ouvrir: () => basculer(true), todo: () => { basculerT(true); devant(todo); } };
})();
