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
  .chat, dialog, .toast{
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
    position:relative; width:64px; height:64px; border-radius:50%; border:0; padding:0;
    display:grid; place-items:center;
    /* Pleine, couleur de la maison : on la trouve d'un coup d'œil, sur le planning comme sur le fond */
    background:radial-gradient(120% 120% at 30% 20%, #6ff08f 0%, var(--vert) 55%, #14a83f 100%);
    box-shadow:inset 0 1px 0 rgba(255,255,255,.28), inset 0 0 0 1px rgba(255,255,255,.12), 0 0 0 4px rgba(255,255,255,.75), 0 10px 24px rgba(20,140,60,.38), 0 2px 6px rgba(32,41,48,.18);
    transition:transform .35s var(--spring), box-shadow .25s; cursor:grab;
  }
  .chat-orb:hover{ transform:scale(1.05); }
  .chat-orb:active{ cursor:grabbing; }
  .chat-orb svg{ width:26px; height:26px; fill:none; stroke:#fff; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
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
  function toast(msg){
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
  const ORB = 64, MARGE = 12, AIMANT = 40;   // à moins de 40 px d'un bord, elle s'y colle
  let msgs = [], chatWs = null, chatEssais = 0, chatSonde = null, chatRetry = null, chatMode = 'ws';
  let presents = [], tapeurs = new Map(), derniereTape = 0, chatAffiches = new Set();
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
  chatOrb.onclick = () => { if (!vientDeGlisser) basculer(true); };
  $('#chat-x').onclick = () => basculer(false);
  chatPanel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); basculer(false); chatOrb.focus(); } });
  addEventListener('resize', () => { if (!chat.hidden) { appliquerTaille(); placer(); } });

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
      if (m.rate) {
        row.style.cursor = 'pointer';
        row.onclick = () => { msgs = msgs.filter(x => x !== m); m.vocal ? envoyerVocal(m._blob, m.vocal.duree, m.pour, !!m.urgent) : envoyer(m.texte, m.pour, !!m.urgent); };
      }
      row.append(de ? avatar(de) : el('span', 'avatar'), b);
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

  function chatRelancer(){
    const p = me(); chat.classList.toggle('sans-nom', !p); chat.hidden = !p && DASHBOARD;
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
  window.oldaBulle = { relancer: chatRelancer, ouvrir: () => basculer(true) };
})();
