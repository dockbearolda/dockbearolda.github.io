/* La bulle de discussion de l'équipe OLDA : une ligne suffit pour la poser dans n'importe quelle appli.
 *
 *   <script src="https://dockbearolda.github.io/bulle.js" defer></script>
 *
 * Trois bulles : la discussion, les Tâches (la blanche, le centre : les notifications de BAT Studio et du
 * planning, et les tâches que Loïc envoie depuis la discussion ; on y répond, on n'en sort pas) et la
 * To Do List (l'orange, à soi seul).
 * Elles flottent au-dessus de l'appli, dans leur propre Shadow DOM (ni ses styles ni ses raccourcis
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
  // Sur myolda.com (derrière Cloudflare Access, 25/11/2026) : les liens vont à bat.myolda.com, et les appels
  // passent par l'appli elle-même (/olda-bat/…, relayé à BAT Studio) — même adresse, donc le cookie Access suit.
  const myolda = /\.myolda\.com$/.test(location.hostname);
  const BAT = (script && script.dataset.bat) || (local && new URLSearchParams(location.search).get('bat'))
    || (myolda ? 'https://bat.myolda.com' : 'https://bat-studio.dockbear.workers.dev');
  const BAT_API = myolda && BAT === 'https://bat.myolda.com' && location.hostname !== 'bat.myolda.com' ? location.origin + '/olda-bat' : BAT;

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
  // L'habit de la personne au poste : sur le Dashboard seulement (les applis gardent la bulle commune).
  const poserHabit = () => { if (DASHBOARD) hote.dataset.poste = document.documentElement.dataset.habit || ''; };
  poserHabit();
  const ardoise = () => hote.dataset.poste === 'melina' ? '154,85,113' : '74,98,116';
  root.innerHTML = `<style>
  :host{ all:initial; position:fixed; left:0; top:0; width:0; height:0; z-index:2147483000; }
  /* L'ardoise et l'ombre en canaux : l'habit de Mélina les change (voir plus bas). */
  :host{ --duck-rgb:74,98,116; --ombre-rgb:42,58,72; }
  /* L'HABIT DE MÉLINA (27/11/2026), sur le Dashboard seulement (data-poste = l'habit du Dashboard, posé par poserHabit) :
     les mêmes formes, l'ardoise devient un vieux rose poudré — comme le reste du Dashboard. */
  :host([data-poste="melina"]){ --duck-rgb:154,85,113; --ombre-rgb:110,60,85; }
  :host([data-poste="melina"]) :is(.chat, .todo, .ctx, .rappel, dialog, .toast, .info){
    --duck:#9a5571; --duck-hover:#884b64; --duck-focus:#c79aad; --ink:#2a2428; --muted:#685b63; --line:#e8dde2;
  }
  .chat, .todo, .ctx, .rappel, dialog, .toast, .info{
    --duck:#4A6274; --duck-hover:#42596A; --duck-focus:#6B8191;
    --ink:#202930; --muted:#5b6b78; --line:#d6dde3; --danger:#d93025;
    --spring:cubic-bezier(.34,1.56,.64,1); --safe-b:env(safe-area-inset-bottom,0px);
    font-family:'Inter','Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;
    font-size:16px; line-height:normal; color:var(--ink); font-variant-numeric:tabular-nums; text-align:left;
  }
  *{ margin:0; padding:0; box-sizing:border-box; -webkit-font-smoothing:antialiased; }
  [hidden]{ display:none !important; }
  button,input,textarea{ font:inherit; color:inherit; }
  button{ cursor:pointer; -webkit-tap-highlight-color:transparent; }
  .avatar{
    --a:66,133,244; width:64px; height:64px; border-radius:50%; flex-shrink:0;
    display:grid; place-items:center; font-size:26px; font-weight:600; letter-spacing:-.01em;
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
    background:rgba(255,255,255,.8); box-shadow:inset 0 0 0 1px rgba(var(--duck-rgb),.14); font-size:15px; font-weight:600; transition:transform .2s var(--spring); }
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
    box-shadow:inset 0 0 0 1px var(--chat-edge), inset 0 1px 0 rgba(255,255,255,.95), 0 0 0 1px rgba(var(--duck-rgb),.14), 0 2px 8px rgba(32,41,48,.08), 0 30px 70px rgba(var(--ombre-rgb),.3);
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
  .chat-grip{ position:absolute; left:50%; top:5px; width:36px; height:4px; margin-left:-18px; border-radius:2px; background:rgba(var(--duck-rgb),.22); }
  /* Une seule ligne, et seulement quand elle dit quelque chose : « écrit… », une pause, une reconnexion */
  .chat-etat{ flex:1; min-width:0; font-size:12.5px; font-weight:600; color:var(--duck); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chat-etat.pause{ color:#3d3a8c; }
  .chat-x{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; }
  .chat-x:hover{ background:rgba(var(--duck-rgb),.1); }
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
    background:rgba(255,255,255,.5); box-shadow:inset 0 0 0 1px rgba(var(--duck-rgb),.12); transition:background-color .2s, color .2s, box-shadow .2s; }
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
  .chat-ic:hover{ background:rgba(var(--duck-rgb),.1); }
  .chat-ic svg{ width:20px; height:20px; fill:none; stroke:var(--ink); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-mic{ background:rgba(255,255,255,.8) !important; box-shadow:inset 0 0 0 1px rgba(var(--duck-rgb),.18); }
  .chat-mic svg{ stroke:var(--duck) !important; }
  /* Urgent : le bouton du message, et sa marque dans la bulle */
  .chat-urg{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; color:var(--muted); transition:background-color .2s, color .2s; }
  .chat-urg:hover{ background:rgba(var(--duck-rgb),.1); }
  .chat-urg svg{ width:21px; height:21px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-urg[aria-pressed="true"]{ background:var(--danger); color:#fff; box-shadow:0 4px 12px rgba(217,48,37,.3); }
  /* Tâche (Loïc) : le message part comme une tâche, dans la bulle Tâches des autres */
  .chat-tache[aria-pressed="true"]{ background:#f59e0b; color:#fff; box-shadow:0 4px 12px rgba(217,119,6,.3); }
  .chat.tache .chat-form textarea{ border-color:rgba(217,119,6,.6) !important; box-shadow:0 0 0 3px rgba(245,158,11,.16) !important; }
  .chat.urgent .chat-form textarea{ border-color:rgba(217,48,37,.6) !important; box-shadow:0 0 0 3px rgba(217,48,37,.14) !important; }
  .chat-tag{ display:inline-block; margin:0 6px 2px 0; padding:1px 7px; border-radius:999px; background:var(--danger); color:#fff; font-size:11px; font-weight:700; vertical-align:1px; }
  .chat-m.moi .chat-tag{ background:#fff; color:var(--danger); }
  /* Ne pas déranger */
  .chat-dnd{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:none; }
  .chat-dnd:hover{ background:rgba(var(--duck-rgb),.1); }
  .chat-dnd svg{ width:19px; height:19px; fill:none; stroke:var(--ink); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .chat-dnd[aria-pressed="true"]{ background:#3d3a8c; }
  .chat-dnd[aria-pressed="true"] svg{ stroke:#fff; fill:#fff; }
  .chat-menu{ position:absolute; z-index:2; top:58px; right:10px; min-width:230px; padding:6px; border-radius:16px; background:rgba(255,255,255,.96);
    box-shadow:inset 0 0 0 1px rgba(var(--duck-rgb),.12), 0 18px 40px rgba(var(--ombre-rgb),.22); animation:chatPop .25s var(--spring); }
  .chat-menu p{ padding:8px 10px 6px; font-size:12.5px; color:var(--muted); line-height:1.35; }
  .chat-menu button{ display:block; width:100%; min-height:44px; padding:0 12px; border:0; border-radius:10px; background:none; text-align:left; font-size:15px; font-weight:600; }
  .chat-menu button:hover{ background:rgba(var(--duck-rgb),.09); }
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
    border:1px solid rgba(var(--duck-rgb),.16); background:rgba(255,255,255,.8); font:inherit; font-size:16px; line-height:1.3; color:var(--ink); outline:none;
    transition:border-color .2s, box-shadow .2s;
  }
  .chat-form textarea:focus{ border-color:var(--duck-focus); box-shadow:0 0 0 3px rgba(var(--duck-rgb),.14); }
  .chat-send{ width:44px; height:44px; flex-shrink:0; display:grid; place-items:center; border:0; border-radius:50%; background:var(--duck); transition:transform .25s var(--spring), opacity .2s; }
  .chat-send:disabled{ opacity:.35; }
  .chat-send:not(:disabled):active{ transform:scale(.9); }
  .chat-send svg{ width:20px; height:20px; fill:none; stroke:#fff; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; }
  .chat.drag .chat-panel, .chat.drag .chat-orb{ box-shadow:inset 0 0 0 1px var(--chat-edge), 0 34px 80px rgba(var(--ombre-rgb),.34); }
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

  /* ---------- LA RELANCE DU LENDEMAIN : plein écran, on répond ou on laisse une note ---------- */
  #relance{ --main:'Inter','Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif; --encre:#202930; --ligne:rgba(var(--duck-rgb),.16);
    width:100%; height:100%; max-width:none; max-height:none; margin:0; border-radius:0; background:#f4f6f8; box-shadow:none; overflow-y:auto; overscroll-behavior:contain; }
  #relance[open]{ display:block; animation:relanceIn .3s ease-out; }
  @keyframes relanceIn{ from{ opacity:0; } }
  #relance::backdrop{ background:#f4f6f8; }
  .relance{ width:min(560px, 100%); min-height:100%; margin:0 auto; display:flex; flex-direction:column; justify-content:center; gap:16px;
    padding:calc(24px + env(safe-area-inset-top,0px)) calc(20px + env(safe-area-inset-right,0px)) calc(24px + var(--safe-b)) calc(20px + env(safe-area-inset-left,0px)); }
  .relance-haut{ display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:28px; }
  .relance-badge{ display:inline-flex; align-items:center; gap:7px; height:28px; padding:0 12px; border-radius:14px; background:rgba(217,48,37,.1); color:var(--danger); font-size:13px; font-weight:700; }
  .relance-badge::before{ content:""; width:8px; height:8px; border-radius:50%; background:currentColor; }
  .relance-n{ font-size:13px; font-weight:600; color:var(--muted); }
  .relance-t{ font-size:26px; font-weight:700; letter-spacing:-.02em; line-height:1.15; }
  .relance-s{ margin-top:-8px; font-size:15px; line-height:1.4; color:var(--muted); }
  .relance-carte{ display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:18px; border-radius:20px; background:#fff;
    box-shadow:0 0 0 1px rgba(var(--duck-rgb),.12), 0 8px 24px rgba(32,41,48,.08); }
  .relance-q{ font-family:var(--main); font-size:19px; font-weight:600; line-height:1.35; color:var(--encre); overflow-wrap:anywhere; }
  .relance-projet{ font-size:15px; font-weight:600; line-height:1.35; color:var(--encre); opacity:.75; overflow-wrap:anywhere; }
  .relance-quand{ font-size:13px; color:var(--muted); }
  .relance-avant{ align-self:stretch; margin-top:8px; padding:10px 12px; border-radius:12px; background:#f4f6f8; font-size:14px; line-height:1.4; overflow-wrap:anywhere; }
  .relance-carte .todo-acts{ margin-top:10px; }
  .relance-ou{ display:flex; align-items:center; gap:12px; font-size:13px; font-weight:600; color:var(--muted); }
  .relance-ou::before, .relance-ou::after{ content:""; flex:1; height:1px; background:var(--line); }
  .relance-l{ font-size:15px; font-weight:600; }
  #relance-txt{ width:100%; min-height:96px; resize:vertical; padding:12px 14px; border:1px solid var(--line); border-radius:14px; background:#fff;
    font-size:16px; line-height:1.4; outline:none; transition:border-color .2s, box-shadow .2s; }
  #relance-txt:focus{ border-color:var(--duck); box-shadow:0 0 0 3px rgba(var(--duck-rgb),.18); }
  .relance-ok{ min-height:52px; border:0; border-radius:16px; background:var(--duck); color:#fff; font-size:16px; font-weight:700; transition:opacity .2s, transform .2s var(--spring); }
  .relance-ok:disabled{ opacity:.4; cursor:default; }
  .relance-ok:not(:disabled):active{ transform:scale(.97); }
  .relance-ok:focus-visible{ outline:3px solid rgba(var(--duck-rgb),.4); outline-offset:2px; }
  @media (hover:hover){ .relance-ok:not(:disabled):hover{ background:var(--duck-hover); } }
  @media (prefers-reduced-motion:reduce){ #relance[open]{ animation:none; } }
  .chat-b .vu{ font-weight:700; opacity:1; }

  /* ---------- La to do list : un bloc-notes à soi, coché ici, rayé partout ---------- */
  .todo{ position:fixed; z-index:36; left:0; top:0; touch-action:none; user-select:none; -webkit-user-select:none;
    --main:'Inter','Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif; --papier:#fff; --encre:#202930; --ligne:rgba(var(--duck-rgb),.12); }
  .todo-orb{ position:relative; width:56px; height:56px; border-radius:50%; border:0; padding:0; display:grid; place-items:center; -webkit-touch-callout:none;
    background:#fff; color:var(--duck);   /* blanche, l'ardoise de la charte OLDA */
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
    box-shadow:0 0 0 1px rgba(var(--duck-rgb),.14), 0 2px 8px rgba(32,41,48,.08), 0 30px 70px rgba(var(--ombre-rgb),.28);
    transform-origin:var(--ox,0) var(--oy,0); animation:chatOpen .42s var(--spring); user-select:text; -webkit-user-select:text; }
  .todo.is-min .todo-panel{ display:none; }
  .todo:not(.is-min) .todo-orb{ display:none; }
  .todo.drag .todo-panel, .todo.drag .todo-orb{ box-shadow:0 0 0 1px rgba(var(--duck-rgb),.14), 0 34px 80px rgba(var(--ombre-rgb),.34); }
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
  .todo-plus:hover{ background:rgba(var(--duck-rgb),.1); }
  .todo-plus svg{ width:20px; height:20px; fill:none; stroke:var(--encre); stroke-width:2.2; stroke-linecap:round; }
  .todo-list{ flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; list-style:none; padding:4px 0 10px; scrollbar-width:thin; }
  .todo-i{ display:flex; align-items:flex-start; min-height:50px; padding-right:4px; border-bottom:1px solid var(--ligne); }
  .todo-cc{ width:44px; height:48px; flex-shrink:0; border:0; background:none; display:grid; place-items:center; }
  .todo-cc:disabled{ cursor:default; }
  .todo-cc svg{ width:22px; height:22px; fill:none; stroke:var(--encre); stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
  .todo-cc circle{ opacity:.55; }
  .todo-i.fait .todo-cc circle{ opacity:1; stroke:var(--duck); fill:var(--duck); }
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
  .todo-ic:hover{ background:rgba(var(--duck-rgb),.09); color:var(--ink); }
  .todo-ic svg{ width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; }
  /* LA RÉPONSE EN UN CLIC : des boutons tous pareils (même hauteur ; deux côte à côte, de même
     largeur), et « fait » dans la même case, en vert. Jamais un mot coupé ni qui déborde : un
     bouton seul prend la ligne, deux qui ne tiennent pas côte à côte passent l'un sous l'autre. */
  .todo-quand{ font-size:12.5px; line-height:1.3; color:var(--muted); }
  /* LE PROJET sous la notification (24/11/2026) : en entier, sur deux lignes au plus ; le nom complet au survol. */
  .todo-projet{ max-width:100%; font-size:13.5px; font-weight:600; line-height:1.3; color:var(--encre); opacity:.75; overflow-wrap:anywhere;
    display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; }
  .todo-i.fait .todo-projet{ opacity:.45; }
  /* La note d'information laissée à la relance du matin */
  .todo-logos{ display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
  .todo-logos:empty{ display:none; }
  .todo-logo{ margin:0; width:96px; display:flex; flex-direction:column; gap:3px; }
  .todo-logo-v{ height:64px; display:grid; place-items:center; border-radius:9px; overflow:hidden; font-size:11px; font-weight:700; color:var(--encre); opacity:.85;
    background:repeating-conic-gradient(#d4dae0 0 25%, #eef1f4 0 50%) 50% / 12px 12px; }
  .todo-logo-v img{ max-width:calc(100% - 8px); max-height:56px; object-fit:contain; }
  .todo-logo figcaption{ font-size:11.5px; line-height:1.25; color:var(--encre); opacity:.75; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .todo-note{ max-width:100%; margin-top:2px; padding:6px 9px; border-radius:9px; background:rgba(var(--duck-rgb),.08); font-size:13px; line-height:1.35; color:var(--encre); overflow-wrap:anywhere; }
  .todo-acts{ display:flex; flex-wrap:wrap; gap:6px; width:100%; margin-top:6px; }
  .todo-act{ flex:1 1 0; height:44px; padding:0 12px; border:1px solid var(--ligne); border-radius:12px; background:#fff; color:var(--encre);
    font-family:var(--main); font-size:14px; font-weight:700; line-height:1; white-space:nowrap; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:6px; transition:transform .15s, opacity .2s; }
  .todo-act:active{ transform:scale(.97); }
  .todo-act:disabled{ opacity:.5; cursor:default; }
  .todo-act:focus-visible{ outline:3px solid rgba(var(--duck-rgb),.4); outline-offset:2px; }
  .todo-act.go{ background:var(--duck); border-color:var(--duck); color:#fff; }
  .todo-act.oui, .todo-act.ok{ background:#137333; border-color:#137333; color:#fff; }
  .todo-act.ok{ cursor:default; opacity:.85; }
  .todo-act svg{ width:16px; height:16px; flex-shrink:0; fill:none; stroke:currentColor; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; }
  @media (hover:hover){ .todo-act:not(.ok):not(:disabled):hover{ filter:brightness(.95); } }
  .todo-vide{ padding:26px 20px 0 56px; font-size:15px; color:var(--muted); }
  .todo-panel:focus{ outline:none; }
  .todo-pied{ flex-shrink:0; display:flex; border-top:1px solid var(--ligne); }
  .todo-pied[hidden]{ display:none; }
  .todo-vider{ flex:1; min-width:0; min-height:44px; padding:0 10px; border:0; background:none; font-size:13.5px; font-weight:600; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .todo-vider + .todo-vider:not([hidden]){ border-left:1px solid var(--ligne); }
  .todo-vider:hover{ color:var(--danger); }
  .todo-revenir:hover{ color:var(--duck); }
  /* Rayée : le trait passe, puis la ligne s'en va. Revenue (Ctrl Z) : elle se rallume. */
  .todo-i.part{ animation:partir .3s ease-in .55s forwards; pointer-events:none; }
  @keyframes partir{ to{ opacity:0; transform:translateX(12px); } }
  .todo-i.revient{ animation:revient 1.2s ease-out; }
  @keyframes revient{ from{ background:rgba(var(--duck-rgb),.14); } }
  /* ---------- Clic droit : cacher / afficher la to do list ou la messagerie ---------- */
  .ctx{ position:fixed; z-index:60; left:0; top:0; min-width:236px; padding:6px; border-radius:14px; background:rgba(255,255,255,.98);
    box-shadow:inset 0 0 0 1px rgba(var(--duck-rgb),.14), 0 18px 40px rgba(var(--ombre-rgb),.24); animation:chatPop .2s var(--spring); }
  .ctx button{ display:flex; align-items:center; gap:10px; width:100%; min-height:44px; padding:0 12px; border:0; border-radius:10px; background:none; text-align:left; font-size:15px; font-weight:600; }
  .ctx button:hover, .ctx button:focus-visible{ background:rgba(var(--duck-rgb),.1); outline:none; }
  .ctx svg{ width:18px; height:18px; flex-shrink:0; fill:none; stroke:var(--muted); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  /* Tout est caché : un petit point en bas à droite pour tout remettre */
  .rappel{ position:fixed; right:calc(2px + env(safe-area-inset-right,0px)); bottom:calc(2px + var(--safe-b)); width:44px; height:44px; border:0; background:none; display:grid; place-items:center; }
  .rappel i{ width:12px; height:12px; border-radius:50%; background:rgba(var(--duck-rgb),.38); box-shadow:0 0 0 2px rgba(255,255,255,.85); transition:transform .2s, background-color .2s; }
  .rappel:hover i, .rappel:focus-visible i{ transform:scale(1.4); background:var(--duck); }
  .rappel.neuf i{ background:var(--danger); }
  /* ---------- LA BLANCHE / L'ORANGE (25/11/2026, Charlie) : la blanche, ce sont les Tâches (le centre) ;
     l'orange, gravée comme la To Do List de chacun. La classe garde son nom, elle va sur #todo-orb. ---------- */
  .mis-orb{ background:radial-gradient(120% 120% at 30% 20%, #ffc163 0%, #f59e0b 55%, #d97706 100%); color:#fff;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.3), 0 0 0 1px rgba(32,41,48,.06), 0 8px 22px rgba(217,119,6,.32), 0 2px 6px rgba(32,41,48,.18); }
  .mis-orb svg{ width:26px; height:26px; }
  .todo-i.wait{ opacity:.55; }
  @media (prefers-reduced-motion:reduce){ .todo-orb{ transition:none; } .todo-panel, .todo-orb.has-new::before, .todo-i.raye .todo-tx > span, .todo-i.raye .todo-cc .v, .todo-i.part, .todo-i.revient, .ctx{ animation:none; } }
  /* ---------- L'info au survol : presque tout de suite, et à jour en direct ---------- */
  .info{ position:fixed; z-index:70; left:0; top:0; max-width:min(320px, calc(100vw - 16px)); padding:8px 12px; border-radius:12px;
    background:var(--ink); color:#fff; font-size:13.5px; font-weight:500; line-height:1.4; overflow-wrap:anywhere;
    box-shadow:0 10px 28px rgba(32,41,48,.28); pointer-events:none; opacity:0; transition:opacity .1s; }
  .info.on{ opacity:1; }
  .info b{ display:block; font-weight:700; }
  .info span{ display:block; color:rgba(255,255,255,.8); }
  @media (prefers-reduced-motion:reduce){ .info{ transition:none; } }

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
      <button type="button" class="chat-urg chat-tache" id="chat-tache" aria-pressed="false" hidden title="Tâche : elle arrive dans sa bulle Tâches, tu es prévenu quand c'est fait" aria-label="Envoyer comme tâche">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="13" height="16.5" rx="2.2"/><path d="M9.5 3h5v3h-5z"/><path d="M9 13.2l2.2 2.2 4-4.4"/></svg>
      </button>
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
  <button type="button" class="todo-orb mis-orb" id="todo-orb" aria-label="Ouvrir ma To Do List">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4.5" width="13" height="16.5" rx="2.2"/><path d="M9.5 3h5v3h-5z"/><path d="M9 13.2l2.2 2.2 4-4.4"/></svg>
    <span class="todo-n" id="todo-n" hidden></span>
  </button>
  <section class="todo-panel" id="todo-panel" aria-label="Ma To Do List" tabindex="-1">
    <header class="todo-head" id="todo-head">
      <span class="chat-grip" aria-hidden="true"></span>
      <h2 class="todo-t">To Do List</h2>
      <small class="todo-c" id="todo-c" aria-live="polite"></small>
      <button type="button" class="chat-x" id="todo-x" aria-label="Réduire la To Do List" title="Réduire (Échap)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
      </button>
    </header>
    <form class="todo-add" id="todo-add" autocomplete="off">
      <input id="todo-txt" type="text" maxlength="300" placeholder="Ajouter une tâche…" enterkeyhint="done" aria-label="Nouvelle tâche">
      <button type="submit" class="todo-plus" aria-label="Ajouter la tâche"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
    </form>
    <ul class="todo-list" id="todo-list" aria-label="Tâches"></ul>
    <div class="todo-pied" id="todo-pied" hidden>
      <button type="button" class="todo-vider" id="todo-vider"></button>
    </div>
  </section>
</div>
<div class="todo mis is-min" id="mis" hidden>
  <button type="button" class="todo-orb" id="mis-orb" aria-label="Ouvrir mes tâches">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16 9.7"/></svg>
    <span class="todo-n" id="mis-n" hidden></span>
  </button>
  <section class="todo-panel" id="mis-panel" aria-label="Tâches" tabindex="-1">
    <header class="todo-head" id="mis-head">
      <span class="chat-grip" aria-hidden="true"></span>
      <h2 class="todo-t">Tâches</h2>
      <small class="todo-c" id="mis-c" aria-live="polite"></small>
      <button type="button" class="chat-x" id="mis-x" aria-label="Réduire les tâches" title="Réduire (Échap)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
      </button>
    </header>
    <ul class="todo-list" id="mis-list" aria-label="Tâches"></ul>
    <div class="todo-pied" id="mis-pied" hidden>
      <button type="button" class="todo-vider todo-revenir" id="mis-revenir" hidden></button>
      <button type="button" class="todo-vider" id="mis-vider" hidden></button>
    </div>
  </section>
</div>
<div class="ctx" id="ctx" role="menu" hidden></div>
<button type="button" class="rappel" id="rappel" hidden aria-label="Remettre les bulles cachées" title="Bulles cachées ici : toucher pour les remettre"><i></i></button>
<dialog id="lire" aria-labelledby="lire-de" aria-describedby="lire-txt">
  <div class="lire">
    <span class="avatar" id="lire-av" aria-hidden="true"></span>
    <div><div class="lire-de" id="lire-de"></div><div class="lire-sous"><span id="lire-quand"></span></div></div>
    <div class="lire-txt" id="lire-txt"></div>
    <button type="button" class="lire-ok" id="lire-ok">J'ai lu</button>
    <div class="lire-n" id="lire-n"></div>
  </div>
</dialog>
<dialog id="relance" aria-labelledby="relance-t" aria-describedby="relance-q">
  <form class="relance" id="relance-form" autocomplete="off">
    <div class="relance-haut"><span class="relance-badge" id="relance-depuis"></span><span class="relance-n" id="relance-n"></span></div>
    <h2 class="relance-t" id="relance-t">Restée sans réponse</h2>
    <p class="relance-s">Réponds, ou dis où ça en est. Tu continues ensuite.</p>
    <div class="relance-carte">
      <p class="relance-q" id="relance-q"></p>
      <p class="relance-projet" id="relance-projet" hidden></p>
      <time class="relance-quand" id="relance-quand"></time>
      <p class="relance-avant" id="relance-avant" hidden></p>
      <div class="todo-acts" id="relance-acts"></div>
    </div>
    <div class="relance-ou">ou</div>
    <label class="relance-l" for="relance-txt">Pas encore possible ? Laisse une note</label>
    <textarea id="relance-txt" rows="3" maxlength="500" placeholder="Ex. : virement attendu jeudi, le client rappelle demain…"></textarea>
    <button type="submit" class="relance-ok" id="relance-ok" disabled>Envoyer la note</button>
  </form>
</dialog>

<div class="toast" id="toast" role="status" aria-live="polite"></div>
<div class="info" id="info" aria-hidden="true"></div>`;
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
    // Une fenêtre qui s'impose (message urgent, relance) couvre tout : le toast passe dedans.
    const modale = [...root.querySelectorAll('dialog')].reverse().find(d => d.open);
    if (window.oldaMessages && !modale) return window.oldaMessages.toast(msg, { ms: 3500 });
    const t = $('#toast'), ici = modale || root; if (t.parentNode !== ici) ici.append(t);
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }
  // UN SEUL ONGLET SONNE (26/11/2026). Chaque appli ouverte (BAT Studio, planning, laser, cotes, Dashboard)
  // a sa bulle et sa connexion : un message urgent sonnait et s'imposait dans toutes à la fois, toutes les 20 s.
  // Les applis n'ont pas la même adresse : elles ne peuvent pas se parler entre elles. C'est BAT Studio, qui
  // voit toutes les connexions de chacun, qui désigne l'onglet « chef » : le dernier qu'on a regardé.
  // Lui seul sonne et ouvre « … t'écrit » ou la relance ; les autres affichent, en silence.
  // Sans WebSocket (BAT Studio local, relevé), ou avec un BAT Studio qui ne le dit pas : chaque onglet est chef.
  let ongletChef = true;
  const onglet = Math.random().toString(36).slice(2, 12);
  // Le son ne part qu'après un premier geste sur la page (règle des navigateurs).
  let audio = null;
  const debloquer = () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state !== 'running') audio.resume(); } catch (_) {} };
  addEventListener('pointerdown', debloquer, { passive: true, capture: true });
  addEventListener('keydown', debloquer, { capture: true });
  function sonner(){
    if (!ongletChef || !audio || audio.state !== 'running') return;
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
  // BAS À DROITE (24/11/2026, Charlie : « les 3 bulles par défaut en bas à droite, toujours déplaçables ») :
  // la première fois, discussion, To Do List puis Tâches se rangent de droite à gauche le long du bas ;
  // plus de place à gauche, la suivante monte au-dessus. Ensuite chacune reste où on la lâche.
  // La place du premier jour se prend bulle visible (vraie taille) et se garde tout de suite : bouger l'une ne déplace pas les autres.
  // PLACE_V : une place gardée d'avant cette règle est oubliée une fois (taille et ouverture restent).
  const PLACE_V = 2, ECART = 16;
  const lirePos = (cle, base) => { const s = store.get(cle) || {}; if (s.v !== PLACE_V) { delete s.x; delete s.y; } return Object.assign(base, s, { v: PLACE_V }); };
  // La première laisse 54 px sous sa pastille (les avatars en ligne sous la discussion), 24 px sous un panneau ;
  // les suivantes s'alignent sur le bas de leur voisine.
  function enBasADroite(voisin, w, h){
    if (!voisin) return { x: innerWidth - w - 24, y: innerHeight - h - (h <= ORB ? 54 : 24) };
    const x = voisin.x - ECART - w;
    return x >= MARGE ? { x, y: voisin.y + voisin.h - h } : { x: innerWidth - w - 24, y: voisin.y - ECART - h };
  }
  let msgs = [], chatWs = null, chatEssais = 0, chatSonde = null, chatRetry = null, chatMode = 'ws';
  let presents = [], tapeurs = new Map(), derniereTape = 0, chatAffiches = new Set(), chatChoix = null;
  let pauses = {}, chatUrgent = false, chatTache = false;   // qui est en « Ne pas déranger » (jusqu'à quand) ; le prochain message est-il urgent ?
  const enPause = id => !!id && Date.parse(pauses[id]) > Date.now();
  // L'heure du dernier message vu, conversation par conversation ({ tous: 1795…, julien: 1795…, … }).
  // (24/11/2026) Avant, on retenait son id : à la reconnexion le serveur ne renvoie que les 80 derniers
  // messages, l'id sorti de la liste (ou supprimé), tout le fil redevenait « non lu » et la pastille rouge restait.
  // Un ancien id se relit en heure : il commence par l'instant d'envoi, en base 36.
  const heureId = id => { const t = parseInt(String(id || '').slice(0, 8), 36); return t > 1.6e12 && t < 4e12 ? t : 0; };
  let chatVu = (() => { const v = store.get(LS_CHAT_VU); return v && typeof v === 'object' ? v : {}; })();
  for (const [fil, v] of Object.entries(chatVu)) if (typeof v !== 'number') chatVu[fil] = heureId(v);
  let chatPour = 'tous';   // à qui part le prochain message : l'équipe, ou une seule personne
  // Le cache est rangé au nom de la personne au poste : un message privé ne s'affiche jamais chez un autre prénom.
  { const c = store.get(LS_CHAT); if (c && c.qui === me()?.id && Array.isArray(c.msgs)) msgs = c.msgs; }

  // --- Place à l'écran : une position (coin haut-gauche), bornée à la fenêtre ---
  const chatPos = lirePos(LS_CHAT_POS, { x: null, y: null, ouvert: DASHBOARD });
  const taille = () => chatPos.ouvert ? { w: chatPanel.offsetWidth || 372, h: chatPanel.offsetHeight || 520 } : { w: ORB, h: ORB };
  function borner(){
    const { w, h } = taille(), vw = innerWidth, vh = innerHeight;
    if (chatPos.x == null) { if (chat.hidden || vw < 200 || vh < 200) return; Object.assign(chatPos, enBasADroite(null, w, h)); store.set(LS_CHAT_POS, chatPos); }   // fenêtre pas encore dimensionnée : on attend le resize
    chatPos.x = Math.min(Math.max(MARGE, chatPos.x), Math.max(MARGE, vw - w - MARGE));
    chatPos.y = Math.min(Math.max(MARGE, chatPos.y), Math.max(MARGE, vh - h - MARGE));
  }
  function placer(){ borner(); chat.style.transform = `translate3d(${Math.round(chatPos.x)}px,${Math.round(chatPos.y)}px,0)`; }
  const garderPos = () => store.set(LS_CHAT_POS, chatPos);
  const rectChat = () => !chat.hidden && chatPos.x != null ? { x: chatPos.x, y: chatPos.y, ...taille() } : null;
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
  addEventListener('resize', () => { if (!chat.hidden) { appliquerTaille(); placer(); } if (!todo.hidden) placerT(); if (!mis.hidden) misF.placer(); });

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
    // Pas sur le Dashboard (25/11/2026, Charlie : « je ne veux plus que les bulles en ligne apparaissent sur le dashboard »).
    if (!la.length || DASHBOARD) en?.remove();
    else { en = en || chatOrb.appendChild(el('span', 'chat-en')); en.replaceChildren(...autres.filter(x => presents.includes(x.id)).map(x => avatar(x))); }
    chatEtat.classList.remove('en');
    if (ecrit.length) { chatEtat.textContent = `${ecrit.join(' et ')} ${ecrit.length > 1 ? 'écrivent' : 'écrit'}…`; return; }
    chatEtat.classList.toggle('pause', enPause(p.id) || (!!dest && enPause(dest.id)));
    if (enPause(p.id)) { chatEtat.textContent = `Ne pas déranger · jusqu’à ${heure(pauses[p.id])}`; return; }
    if (dest && enPause(dest.id)) { chatEtat.textContent = `En pause jusqu’à ${heure(pauses[dest.id])}`; return; }
    chatEtat.classList.toggle('en', chatMode !== 'coupe' && la.length > 0);
    chatEtat.textContent = chatMode === 'coupe' ? 'Reconnexion…' : la.length ? `● En ligne : ${la.join(', ')}` : '';
  }
  // Non lus d'une conversation : les messages des autres arrivés après le dernier vu de ce fil.
  // Un message privé confirmé « Lu » (ici, sur un autre appareil ou une autre appli) ne compte plus.
  const vuA = fil => Number(chatVu[fil]) || 0;
  function nonLus(fil){
    const p = me(), vu = vuA(fil);
    return msgs.filter(m => filDe(m) === fil && !m.wait && m.de !== p?.id && !(m.pour === p?.id && m.lu) && Date.parse(m.at) > vu).length;
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
      const t = Date.parse(dernier.at) || 0;
      if (t > vuA(chatPour)) { chatVu[chatPour] = t; store.set(LS_CHAT_VU, chatVu); }
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
    else fetch(`${BAT_API}/api/chat/lu/${encodeURIComponent(m.id)}?qui=${encodeURIComponent(p.id)}`, { method: 'POST' }).catch(() => {});
  }
  // Retirer mon message : aussitôt chez moi, le serveur le retire chez les autres.
  function supprimerMsg(m){
    const p = me(); if (!p || m.de !== p.id) return;
    chatChoix = null; msgs = msgs.filter(x => x !== m); garderChat(); renderChat();
    if (chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'suppr', id: m.id }));
    else fetch(`${BAT_API}/api/chat/suppr/${encodeURIComponent(m.id)}?qui=${encodeURIComponent(p.id)}`, { method: 'POST' }).catch(() => {});
  }
  const garderChat = () => store.set(LS_CHAT, { qui: me()?.id, msgs: msgs.filter(m => !m.wait && !m.rate).slice(-200) });
  // Un « toc » discret, différent du ding-dong des notifications.
  function toc(){
    if (!ongletChef || !audio || audio.state !== 'running') return;
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
    try { ws = new WebSocket(BAT_API.replace(/^http/, 'ws') + '/api/chat/ws?qui=' + encodeURIComponent(p.id) + '&onglet=' + onglet + (document.hidden ? '' : '&vu=1')); } catch (_) { return sonder(); }
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
      else if (e.type === 'lu') { const m = msgs.find(x => x.id === e.id); if (m) { m.lu = e.lu; garderChat(); renderChat(); aLire(); } }   // lu dans un autre onglet : ici aussi, c'est fini
      else if (e.type === 'refus') { const m = msgs.find(x => x.cle === e.cle); if (m) { m.wait = false; m.rate = true; renderChat(); } }
      else if (e.type === 'chef') { if (ongletChef !== !!e.chef) { ongletChef = !!e.chef; aLire(); } }
    };
    ws.onclose = () => {
      if (chatWs !== ws) return;
      chatWs = null; presents = []; ongletChef = true;   // seul, on redevient son propre chef
      // Jamais ouvert : pas de WebSocket ici (BAT Studio local) → on relève. Sinon on se reconnecte, de plus en plus calmement.
      if (!ouvert && chatEssais === 0) return sonder();
      chatMode = 'coupe'; majEtat();
      chatRetry = setTimeout(connecter, Math.min(15000, 1000 * 2 ** chatEssais++));
    };
  }
  async function relire(){
    try {
      const dernier = msgs.filter(m => !m.wait && !m.rate).at(-1);
      const r = await fetch(`${BAT_API}/api/chat?qui=${encodeURIComponent(me()?.id || '')}${dernier ? '&depuis=' + encodeURIComponent(dernier.id) : ''}`, { cache: 'no-store' });
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
    const choix = [{ id: 'tous', name: 'Équipe', tint: ardoise() }, ...PROFILES.filter(x => x.id !== p.id)];
    $('#chat-pour').replaceChildren(...choix.map(x => {
      const b = el('button', (x.id === 'tous' ? 'tous' : '') + (presents.includes(x.id) ? ' en-ligne' : '') + (enPause(x.id) ? ' en-pause' : '')); b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-checked', String(chatPour === x.id)); b.setAttribute('aria-selected', String(chatPour === x.id));
      b.style.setProperty('--a', ardoise());
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
    if (!chef()) chatTache = false;
    $('#chat-urg').hidden = !dest; $('#chat-urg').setAttribute('aria-pressed', String(chatUrgent));
    $('#chat-tache').hidden = !chef(); $('#chat-tache').setAttribute('aria-pressed', String(chatTache));
    chat.classList.toggle('urgent', chatUrgent); chat.classList.toggle('tache', chatTache);
    chatTxt.placeholder = chatTache ? `Tâche pour ${dest ? dest.name : 'toute l’équipe'}…`
      : !dest ? 'Écrire à l’équipe…' : chatUrgent ? `Urgent pour ${dest.name}…` : `Écrire à ${dest.name}…`;
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
    fetch(`${BAT_API}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ de: p.id, ...corps, cle: m.cle }) })
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
      const r = await fetch(`${BAT_API}/api/chat/vocal`, { method: 'POST', headers: { 'Content-Type': blob.type || 'audio/webm' }, body: blob });
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
        try { const r = await fetch(`${BAT_API}/api/chat/vocal/${v.id}`); if (!r.ok) throw 0; url = URL.createObjectURL(await r.blob()); sons.set(v.id, url); }
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
    $('#chat-mic').hidden = rec || texte || chatTache || !window.MediaRecorder;
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
  $('#chat-form').onsubmit = e => {
    e.preventDefault(); if (enregistreur) return finirVocal();
    const t = chatTxt.value; chatTxt.value = ''; ajuster();
    if (!chatTache) return envoyer(t);
    const p = me(), pour = chatPour === 'tous' ? PROFILES.filter(x => x.id !== p?.id).map(x => x.id) : [chatPour];
    chatTache = false; renderPour(); modeSaisie();
    donnerTache(t, pour).then(ok => { if (!ok && !chatTxt.value) { chatTxt.value = t; ajuster(); } });
  };
  chatList.addEventListener('scroll', () => { if (chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 40) lireTout(); }, { passive: true });
  // On regarde cet onglet : il devient le chef (BAT Studio le dit aux autres onglets de la même personne).
  const vu = () => { if (!document.hidden && chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'vu' })); };
  addEventListener('focus', vu);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    lireTout(); vu();
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
    if (!file.length || !ongletChef) {
      if (lireDlg.open) lireDlg.close(); clearInterval(lireDing); lireDing = null; lireCourant = null;
      const de = file.length && profilDe(file[0].de);
      document.title = file.length ? `🔴 ${de ? de.name : 'Message'} t’écrit` : titreAvant;
      setTimeout(relancer); return;
    }
    $('#lire-n').textContent = file.length > 1 ? `Encore ${file.length - 1} message${file.length > 2 ? 's' : ''} après celui-ci` : '';
    if (lireCourant) return;
    const m = lireCourant = file[0], de = profilDe(m.de);
    lireDlg.style.setProperty('--a', de ? de.tint : ardoise());
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

  $('#chat-urg').onclick = () => { chatUrgent = !chatUrgent; if (chatUrgent) chatTache = false; renderPour(); modeSaisie(); chatTxt.focus({ preventScroll: true }); };
  // TÂCHE DEPUIS LE CHAT (25/11/2026, Charlie : « Loïc doit pouvoir envoyer une tâche directement depuis le chat ») :
  // bouton Tâche enfoncé, le message part comme une tâche à la conversation ouverte (Équipe : à tous),
  // arrive dans leur bulle Tâches, et Loïc la suit dans la sienne. Le bouton se relâche après l'envoi.
  $('#chat-tache').onclick = () => { chatTache = !chatTache; if (chatTache) chatUrgent = false; renderPour(); modeSaisie(); chatTxt.focus({ preventScroll: true }); };

  // --- Ne pas déranger : ni son ni fenêtre chez moi, les autres voient jusqu'à quand ---
  const menu = $('#chat-menu'), dnd = $('#chat-dnd');
  const dansMs = ms => new Date(Date.now() + ms).toISOString();
  const demainMatin = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(7, 30, 0, 0); return d.toISOString(); };
  function pauser(jusqua){
    const p = me(); if (!p) return;
    if (jusqua) pauses[p.id] = jusqua; else delete pauses[p.id];
    majPause(); menu.hidden = true;
    if (chatWs?.readyState === 1) chatWs.send(JSON.stringify({ type: 'pause', jusqua }));
    else fetch(`${BAT_API}/api/chat/pause?qui=${encodeURIComponent(p.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jusqua }) }).catch(() => {});
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

  // ---------- La To Do List : à soi seul, cochée ici, rayée partout (BAT Studio, /api/todo) ----------
  // Une liste par prénom, rangée chez BAT Studio : cochée sur le Dashboard, elle l'est dans chaque appli.
  // TÂCHES / TO DO LIST (25/11/2026, Charlie : « mes tâches arrivent dans Tâches, même celles envoyées
  // à Loïc, et l'autre bulle devient une To Do List ») : les notifications de BAT Studio pour moi
  // (cocher = lu) ne sont plus ici mais dans la bulle Tâches, pour chacun, Loïc compris :
  // Mélina et Loïc, un BAT validé à lancer si le client a payé ; Julien, les cotes à prendre ;
  // Charlie, la production (l'imprimante de la bulle PRT, les demandes de PRT).
  // Le clic droit (un appui long au doigt) sur une bulle la cache sur ce site.
  const LS_TODO = 'olda_todo', LS_TODO_POS = 'olda_todo_pos', LS_TODO_VUS = 'olda_todo_vus', LS_CACHES = 'olda_caches';
  const todo = $('#todo'), todoOrb = $('#todo-orb'), todoPanel = $('#todo-panel'), todoList = $('#todo-list'), todoTxt = $('#todo-txt');
  const ORB_T = 56, BAT_ORIGINE = (() => { try { return new URL(BAT).origin; } catch (_) { return ''; } })();
  const caches = Object.assign({ todo: false, chat: false, mis: false }, store.get(LS_CACHES) || {});
  const todoPos = lirePos(LS_TODO_POS, { x: null, y: null, ouvert: false });
  const todoVus = new Set(store.get(LS_TODO_VUS) || []);
  let taches = [], notifsT = [], todoMinuterie = null, rayes = new Set();
  // RAYÉE = PARTIE, CTRL Z LA RAMÈNE (22/11/2026) : une notification cochée s'en va après son trait.
  // Ctrl Z (⌘ Z sur Mac) ou « Faire revenir » rallume les 5 dernières rayées, une à une ;
  // rayer une revenue la renvoie. Les revenues et l'heure où on les a rayées restent sur l'appareil.
  const LS_TODO_REV = 'olda_todo_revenues', RETOURS = 5, MAC = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent);
  let revenues = new Set(), rayeesA = {}, partantes = new Set();
  function lireRev(){
    const r = store.get(LS_TODO_REV), ok = r && r.qui === me()?.id;
    revenues = new Set(ok && Array.isArray(r.ids) ? r.ids : []);
    rayeesA = ok && r.a && typeof r.a === 'object' ? r.a : {};
  }
  const garderRev = () => store.set(LS_TODO_REV, { qui: me()?.id, ids: [...revenues], a: rayeesA });

  // --- Place et taille, comme la bulle de discussion ---
  const tailleT = () => todoPos.ouvert ? { w: todoPanel.offsetWidth || 340, h: todoPanel.offsetHeight || 480 } : { w: ORB_T, h: ORB_T };
  function bornerT(){
    const { w, h } = tailleT(), vw = innerWidth, vh = innerHeight;
    if (todoPos.x == null) { if (todo.hidden || vw < 200 || vh < 200) return; Object.assign(todoPos, enBasADroite(rectChat(), w, h)); store.set(LS_TODO_POS, todoPos); }   // à gauche de la discussion
    todoPos.x = Math.min(Math.max(MARGE, todoPos.x), Math.max(MARGE, vw - w - MARGE));
    todoPos.y = Math.min(Math.max(MARGE, todoPos.y), Math.max(MARGE, vh - h - MARGE));
  }
  function placerT(){ bornerT(); todo.style.transform = `translate3d(${Math.round(todoPos.x)}px,${Math.round(todoPos.y)}px,0)`; }
  const garderPosT = () => store.set(LS_TODO_POS, todoPos);
  const rectTodo = () => !todo.hidden && todoPos.x != null ? { x: todoPos.x, y: todoPos.y, ...tailleT() } : null;
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
  const devant = n => { for (const b of [todo, chat, mis]) b.style.zIndex = b === n ? 36 : 35; };
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
  // LA RÉIMPRESSION D'UN LOGO (27/11/2026, Charlie : « quand Julien me relance un logo, les logos ne s'affichent pas ») :
  // la bulle de la réimpression (bat-…-r1) et ce qu'elle demande, puis ses logos en vignettes (`logos` de la notification ;
  // l'image vient de sa fiche PRT, BAT Studio en fait un PNG à Dropbox, même pour un PDF).
  const estReimpression = n => n.type === 'prt-imprimer' && (/demande une réimpression/.test(n.texte || '') || /-r\d+$/.test(n.carte?.id || ''));
  function vignettesReimpression(n){
    const box = el('div', 'todo-logos');
    for (const l of n.logos) {
      const f = el('figure', 'todo-logo'), v = el('span', 'todo-logo-v'), img = new Image();
      img.alt = ''; img.decoding = 'async'; img.draggable = false;
      img.src = `${BAT_API}/api/dropbox/prt?id=${encodeURIComponent(n.carte.id)}&nom=${encodeURIComponent(l.fichier)}&apercu=1`;
      img.onerror = () => { v.textContent = (String(l.fichier).match(/\.(\w+)$/)?.[1] || 'logo').toUpperCase(); };
      v.append(img);
      const c = el('figcaption'); c.textContent = [l.nom || l.fichier, l.vue, `${l.largeur_mm} mm`, `× ${l.quantite}`].filter(Boolean).join(' · ');
      f.title = c.textContent; f.append(v, c); box.append(f);
    }
    return box;
  }
  function ligneNotif(n, court = true){
    const t = String(n.titre || ''), x = String(n.texte || '');
    const raccourcir = v => (court ? nomCourt(v) : String(v).trim()).toLocaleUpperCase('fr');   // les clients, toujours en majuscules
    const avant = t.replace(/^Rappel — /, '').split(' : ')[0];
    const client = raccourcir(avant.split(' · ')[0].replace(/\s*\(Pro\)$/, '')) || 'un client';
    // L'auteur : celui que la notification nomme, sinon celui que son ancien texte citait.
    const nomme = profilDe(n.de)?.name
      || (n.type === 'prt-imprimer' && x.match(/^Cotes prises par ([^:]+?) :/)?.[1]) || '';
    switch (n.type) {
      case 'bat-valide':
        if (/ : payé, en PRT$/.test(t)) return `${nomme || 'Le bureau'} a validé le paiement de ${client}`;
        if (/ : lancé en production, en PRT$/.test(t)) return `${nomme || 'Le bureau'} a lancé ${client} en production`;
        return `${client} a validé son BAT`;
      // Une commande mix (BAT Studio, « Commande mix client ») suit le circuit d'un BAT.
      case 'mix-valide': return /crée le PRT/.test(t) ? `${client} a validé sa commande mix : crée le PRT` : `${client} : commande mix ${/feu vert/.test(t) ? 'lancée' : 'payée'}, à envoyer en production`;
      case 'bat-paiement': case 'bat-production': return /Commande mix/.test(t) ? `${client} a validé sa commande mix` : `${client} a validé son BAT`;
      case 'bat-note': return `${client} a laissé une note sur son BAT`;
      case 'bat-relance': return `${client} n’a pas répondu au BAT`;
      // BAT laser (gabarits-laser, 25/11/2026) : le client valide sur /bat/<id>, ou dit ce qu'il faut changer.
      case 'laser-valide': return `${client} a validé son BAT laser`;
      case 'laser-note': { const d = x.length > 90 ? x.slice(0, 89) + '…' : x; return d ? `${client} demande une modif : « ${d} »` : `${client} demande une modif de son BAT laser`; }
      // Le PRT n'est pas arrivé dans le planning 20 min après l'envoi (server/notifs.mjs verifierPrts).
      // Une commande mix ou boutique envoyée en production (27/11/2026) : « à imprimer », comme les cotes prises.
      // Une réimpression demandée depuis la Presse (planning, 27/11/2026) : avant, elle se lisait « Julien a validé les cotes ».
      case 'prt-imprimer': return n.rate ? `PRT de ${client} pas arrivé : à renvoyer` : estReimpression(n) ? `${nomme || 'L’atelier'} relance un logo de ${client} : à réimprimer` : /envoyées en production/.test(x) ? `${client} : PRT à imprimer` : nomme ? `${nomme} a validé les cotes de ${client}` : `Cotes prises pour ${client}`;
      case 'presse-fini': return `La commande ${client} est terminée`;
      default: return t;
    }
  }

  // LE PROJET DE LA NOTIFICATION (24/11/2026, Charlie : un client a souvent plusieurs projets en cours).
  // BAT Studio et le planning l'envoient (`projet`) ; une notification d'avant le dit dans son titre
  // (« CLIENT · Projet : … »). Rien quand la ligne le dit déjà (« … a validé sa commande mix »).
  function projetNotif(n){
    const t = String(n.titre || ''), x = String(n.texte || '');
    let p = String(n.projet || '').trim();
    if (!p) {
      const avant = t.replace(/^Rappel — /, '').split(' : ')[0], i = avant.indexOf(' · ');
      if (i > 0) p = avant.slice(i + 3);
    }
    p = p.replace(/\s*\(Pro\)$/, '').replace(/^Réassort boutique\s*·\s*/i, '').trim();
    return p && !ligneNotif(n, false).toLocaleLowerCase('fr').includes(p.toLocaleLowerCase('fr')) ? p : '';
  }
  // La ligne et son projet, d'un trait (l'info au survol de la bulle, la case à cocher lue à voix haute).
  const ligneEtProjet = n => { const p = projetNotif(n); return p ? `${ligneNotif(n)} · ${p}` : ligneNotif(n); };

  // --- Afficher (les notifications, dans la bulle Tâches ; la To Do List, ici) ---
  const notifsVisibles = () => notifsT.filter(n => !n.lu || revenues.has(n.id) || partantes.has(n.id));
  // Les 5 dernières rayées (ici ou ailleurs), la plus récente d'abord ; celles déjà revenues comptent.
  const rayeeLe = n => Date.parse(rayeesA[n.id] || n.lu) || 0;
  const aFaireRevenir = () => notifsT.filter(n => n.lu).sort((a, b) => rayeeLe(b) - rayeeLe(a)).slice(0, RETOURS)
    .filter(n => !revenues.has(n.id) && !partantes.has(n.id));
  const notifsAFaire = () => notifsT.filter(n => !n.lu);
  function majCompteT(){
    const n = taches.filter(t => !t.fait).length, c = $('#todo-n');
    c.hidden = !n || todoPos.ouvert; c.textContent = n > 9 ? '9+' : String(n);
    $('#todo-c').textContent = n ? `${n} à faire` : '';
    todoOrb.setAttribute('aria-label', n ? `Ma To Do List : ${n} à faire` : 'Ouvrir ma To Do List');
  }
  function ligneT({ texte, projet, detail, quand, qui, fait, cocher, ouvrir, suppr, actions, note }){
    const li = el('li', 'todo-i' + (fait ? ' fait' : ''));
    const c = el('button', 'todo-cc'); c.type = 'button'; c.setAttribute('role', 'checkbox'); c.setAttribute('aria-checked', String(!!fait));
    c.setAttribute('aria-label', projet ? `${texte} · ${projet}` : texte); c.innerHTML = SVG('<circle cx="12" cy="12" r="8.5"/><path class="v" d="M7.5 12.5l3 3 6-7"/>');
    if (cocher) c.onclick = cocher; else c.disabled = true;
    const corps = el('div', 'todo-corps');
    const tx = el('span', 'todo-tx'), sp = el('span'); sp.textContent = texte; tx.append(sp); corps.append(tx);
    if (projet) { const pj = el('span', 'todo-projet'); pj.textContent = projet; pj.title = projet; corps.append(pj); }
    if (detail) corps.append(detail);
    // Reçue quand : « Aujourd’hui à 14:32 », « Hier à 09:10 », « samedi 21 novembre à 18:05 ».
    if (quand && !isNaN(Date.parse(quand))) { const q = el('time', 'todo-quand'); q.dateTime = quand; q.textContent = `${qui ? qui + ' · ' : ''}${jour(quand)} à ${heure(quand)}`; corps.append(q); }
    if (note) { const nt = el('span', 'todo-note'); nt.textContent = `Ta note : ${note}`; corps.append(nt); }
    if (actions?.length) { const a = el('div', 'todo-acts'); a.append(...actions); corps.append(a); }
    li.append(c, corps);
    if (ouvrir) { const o = el('button', 'todo-ic'); o.type = 'button'; o.title = 'Ouvrir'; o.setAttribute('aria-label', 'Ouvrir : ' + texte); o.innerHTML = SVG('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'); o.onclick = ouvrir; li.append(o); }
    if (suppr) { const d = el('button', 'todo-ic'); d.type = 'button'; d.title = 'Supprimer'; d.setAttribute('aria-label', 'Supprimer : ' + texte); d.innerHTML = SVG('<path d="M6 6l12 12M18 6L6 18"/>'); d.onclick = suppr; li.append(d); }
    return li;
  }
  // Les lignes des notifications (bulle Tâches) ; le trait de celles qu'on vient de cocher ne se joue qu'une fois.
  let rayesN = new Set();
  function lignesNotifs(){
    const out = notifsVisibles().map(n => {
      const cocher = !n.lu ? () => cocherNotif(n) : revenues.has(n.id) ? () => rayerNotif(n) : null;
      const li = ligneT({ texte: ligneNotif(n), projet: projetNotif(n), detail: !n.lu && estReimpression(n) && n.carte && n.logos?.length ? vignettesReimpression(n) : null, quand: n.at, fait: !!n.lu, cocher, actions: boutonsNotif(n), note: !n.lu && n.note?.texte });
      li.dataset.id = n.id;
      if (partantes.has(n.id)) li.classList.add('part');
      const entier = ligneNotif(n, false);
      if (entier !== ligneNotif(n)) li.querySelector('.todo-tx').title = entier;   // le nom complet, au survol
      if (rayesN.has(n.id)) li.classList.add('raye');
      return li;
    });
    rayesN = new Set();
    return out;
  }
  function renderTodo(){
    const p = me(); if (!p) return;
    const out = [];
    for (const t of taches) {
      const li = ligneT({ texte: t.texte, fait: !!t.fait, cocher: () => cocherTache(t), suppr: t.fait ? () => supprimerTache(t) : null });
      if (rayes.has(t.id)) li.classList.add('raye');
      out.push(li);
    }
    if (!out.length) { const v = el('li', 'todo-vide'); v.textContent = 'Rien à faire. Profites-en ✌️'; out.push(v); }
    todoList.replaceChildren(...out);
    rayes = new Set();
    const finies = taches.filter(t => t.fait).length;
    $('#todo-vider').textContent = `Effacer les terminées (${finies})`;
    $('#todo-pied').hidden = !finies;
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
      const r = await fetch(`${BAT_API}/api/todo?qui=${encodeURIComponent(c.qui)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: c.items }) });
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
    n.lu = new Date().toISOString();
    fetch(`${BAT_API}/api/notifs/${encodeURIComponent(n.id)}/lu`, { method: 'POST' }).catch(() => {});
    rayerNotif(n);
  }
  // Le trait, puis la ligne part (elle reste lue chez BAT Studio).
  function rayerNotif(n){
    // Le focus vient dans la liste (Safari ne le donne pas au clic) : Ctrl Z marche aussitôt.
    const garderFocus = !saisie(root.activeElement || document.activeElement);
    rayeesA[n.id] = new Date().toISOString(); revenues.delete(n.id); garderRev();
    partantes.add(n.id); rayesN.add(n.id); renderMis();
    if (garderFocus) $('#mis-panel').focus({ preventScroll: true });
    setTimeout(() => { if (partantes.delete(n.id)) renderMis(); }, reduced.matches ? 300 : 900);
  }
  function faireRevenir(){
    const n = aFaireRevenir()[0];
    if (!n) return toast(`Plus rien à faire revenir : seules les ${RETOURS} dernières rayées reviennent.`);
    revenues.add(n.id); garderRev();
    if (!misF.pos.ouvert) misF.basculer(true);
    renderMis();
    const li = [...misList.children].find(x => x.dataset.id === n.id);
    if (li) { li.classList.add('revient'); li.scrollIntoView({ block: 'nearest' }); }
  }
  $('#mis-revenir').onclick = faireRevenir;
  const estAnnuler = e => (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z');
  const saisie = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  // Dans la bulle Tâches : partout (elle n'a plus de champ).
  $('#mis-panel').addEventListener('keydown', e => {
    if (!estAnnuler(e) || saisie(e.target)) return;
    e.preventDefault(); faireRevenir();
  });
  // Sur le Dashboard, n'importe où (les applis gardent leur propre Ctrl Z).
  if (DASHBOARD) document.addEventListener('keydown', e => {
    if (!estAnnuler(e) || e.defaultPrevented || mis.hidden || !me() || saisie(e.composedPath()[0])) return;
    e.preventDefault(); faireRevenir();
  });
  // LA RÉPONSE EN UN CLIC (21/11/2026) : « tout le travail doit être déjà mâché, on n'a plus qu'à
  // cliquer ». Chaque notification arrive avec sa question et ses réponses ; répondre la coche.
  const PLANCHE = 'http://127.0.0.1:47831/bat';   // la Planche DTF de Fast White, sur le poste
  // Un seul onglet par appli (25/11/2026) : sur le Dashboard, dans son onglet à lui ; ailleurs, l'onglet
  // du navigateur nommé d'après le site — re-cliquer y ramène au lieu d'ouvrir une fenêtre de plus.
  const ouvrirLien = url => {
    if (window.oldaOuvrir) return window.oldaOuvrir(url);
    try { window.open(url, 'olda-' + new URL(url).host.replace(/[^\w-]/g, '-')); } catch (_) {}
  };
  function ouvrirBatT(lien){
    let u; try { u = new URL(lien || '/', BAT + '/'); } catch (_) { return; }
    if (u.origin !== BAT_ORIGINE) return;   // le lien ne mène que chez BAT Studio
    u.searchParams.set('poste', me()?.id || '');
    ouvrirLien(u.toString());
  }
  const GABARITS = myolda ? 'https://laser.myolda.com/' : 'https://gabarits-laser.dockbear.workers.dev/';
  const ouvrirGabaritsT = () => ouvrirLien(GABARITS);
  // direct : « Envoyer en production » — la Planche crée le PRT d'elle-même (rien d'autre sur la planche).
  const ouvrirPlancheT = (c, direct) => ouvrirLien(`${PLANCHE}?id=${encodeURIComponent(c.id)}&zone=${encodeURIComponent(c.zone)}${direct ? '&auto=1' : ''}`);
  // ENVOYER UN PRT (22/11/2026) : la Planche s'ouvre, BAT Studio note l'heure. Si 20 min plus tard
  // aucun PRT n'est arrivé sur la bulle du planning (Planche fermée, connexion impossible, RIP raté),
  // la notification revient : aucun PRT oublié. Pas noté (réseau) : la ligne reste à faire chez BAT Studio.
  async function envoyerPrtT(n){
    ouvrirPlancheT(n.carte, true);   // tout de suite, dans le clic : sinon le navigateur bloque la fenêtre
    const r = await fetch(`${BAT_API}/api/notifs/${encodeURIComponent(n.id)}/envoi`, { method: 'POST' }).catch(() => null);
    if (r?.ok) { n.envoi = new Date().toISOString(); delete n.rate; }
  }
  // « Le client a-t-il payé ? » (Mélina / Loïc, un BAT de Charlie) ou « part en production ? » (celui qui a
  // fait le BAT, 26/11/2026) — Oui : la bulle part dans PRT avec la règle, Julien est prévenu ; Non : la question
  // revient le lendemain matin. Le serveur coche aussi la question de l'autre.
  async function payerT(n, paye){
    const r = await fetch(`${BAT_API}/api/suivi/${encodeURIComponent(n.projetId)}/paiement`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paye, qui: me()?.id || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 404) throw new Error(j.error || 'Erreur ' + r.status);   // 404 : déjà réglé
    toast(n.type === 'bat-production'
      ? (paye ? (/Commande mix/.test(n.titre || '') ? 'En production : la commande mix est débloquée dans PRT.' : 'En production : Julien est prévenu, cotes à prendre.') : 'Noté : la question reviendra demain matin.')
      : (paye ? (/Commande mix/.test(n.titre || '') ? 'Payé : la commande mix est débloquée dans PRT.' : 'Payé : Julien est prévenu, cotes à prendre.') : 'Noté : non payé, la question reviendra demain matin.'));
  }
  async function prevenuT(n){
    if (!n.carte?.id) return;   // une notification d'avant : rien à ranger
    const r = await fetch(`${BAT_API}/api/suivi/${encodeURIComponent(n.carte.id)}/prevenu`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
    toast('Client prévenu : la commande est aux Archives.');
  }
  // Le texte prêt à coller (le lien du client, le message « commande prête »).
  async function copierT(n){
    try { await navigator.clipboard.writeText(n.copie); }
    catch (_) { const t = document.createElement('textarea'); t.value = n.copie; document.body.append(t); t.select(); const ok = document.execCommand('copy'); t.remove(); if (!ok) throw new Error('Copie refusée par le navigateur.'); }
    toast('Copié : colle-le dans WhatsApp.');
  }
  // Ce que demande la notification : [{ label, cls, fn }] ; une réponse coche la ligne.
  // ON RÉPOND, ON N'OUVRE PAS (25/11/2026, Charlie : « tout doit se gérer depuis le centre, ils n'ont plus qu'à
  // valider ou non ») : plus de « Ouvrir le planning / la presse / Ouvrir » ; les bulles du planning ouvrent
  // déjà les cartes. Restent seulement les boutons vers ce qui ne se fait qu'ailleurs : Créer le PRT, Refaire
  // le BAT, Prendre les cotes, Gabarits laser.
  function reponsesNotif(n){
    const vu = { label: 'Vu', cls: 'oui', fn: () => {} };
    switch (n.type) {
      case 'bat-paiement': return n.projetId
        ? [{ label: 'Oui, payé', cls: 'oui', fn: () => payerT(n, true) }, { label: 'Non', cls: 'non', fn: () => payerT(n, false) }]
        : [];
      case 'bat-production': return n.projetId
        ? [{ label: 'Oui, en production', cls: 'oui', fn: () => payerT(n, true) }, { label: 'Pas encore', cls: 'non', fn: () => payerT(n, false) }]
        : [];
      case 'bat-relance': return n.copie ? [{ label: 'Copier le lien', cls: 'go', fn: () => copierT(n) }] : [];
      case 'laser-valide': return [{ label: 'Ouvrir Gabarits laser', cls: 'go', fn: ouvrirGabaritsT }, { label: 'Vu', cls: 'oui', fn: () => {} }];
      case 'laser-note': return [{ label: 'Refaire le BAT', cls: 'go', fn: ouvrirGabaritsT }];
      case 'bat-valide': return [{ label: 'Prendre les cotes', cls: 'go', fn: () => ouvrirBatT(n.lien) }];
      case 'bat-note': return [{ label: 'Refaire le BAT', cls: 'go', fn: () => ouvrirBatT(n.projetId ? `/?projet=${encodeURIComponent(n.projetId)}` : n.lien) }];
      case 'prt-imprimer': return n.carte
        ? [{ label: n.rate ? 'Renvoyer' : 'En production', cls: 'oui', fn: () => envoyerPrtT(n) }]
        : [vu];
      // Une commande mix validée par le client (25/11/2026) : la suite, c'est le PRT, dans BAT Studio.
      case 'mix-valide': return [{ label: 'Créer le PRT', cls: 'go', fn: () => ouvrirBatT(n.lien) }];
      // « Client prévenu » range la bulle du planning : de Terminé aux Archives.
      // Mélina et Loïc n'ont que ce bouton à toucher (22/11/2026) ; l'un répond, c'est coché chez l'autre.
      case 'presse-fini': return [{ label: 'Client prévenu', cls: 'oui', fn: () => prevenuT(n) }];
      // La note d'un client sur sa commande mix, le BAT atelier : le travail se fait dans BAT Studio.
      case 'mix-note': return [{ label: 'Refaire la commande', cls: 'go', fn: () => ouvrirBatT(n.lien) }];
      default: return [vu];
    }
  }
  const FAIT = { 'laser-valide': 'Vu', 'laser-note': 'Refait', 'prt-imprimer': 'Envoyé', 'bat-paiement': 'Répondu', 'bat-production': 'Répondu', 'bat-relance': 'Lien copié', 'presse-fini': 'Client prévenu' };
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
        r.onclick = () => { envoyerPrtT(n); toast('Renvoyé à la Planche : le PRT se recrée.'); };
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
    // Un PRT revenu (pas arrivé) sonne de nouveau : sa clé change.
    const cle = n => n.rate ? `${n.id}/${n.rate}` : n.id;
    const neuves = notifsT.filter(n => !n.lu && !todoVus.has(cle(n)));
    if (!neuves.length) return;
    neuves.forEach(n => todoVus.add(cle(n))); store.set(LS_TODO_VUS, [...todoVus].slice(-300));
    if (!misF.pos.ouvert) misOrb.classList.add('has-new');
    $('#rappel').classList.add('neuf');
    // Les notifications n'arrivent qu'ici, dans « Tâches » : la bulle sonne, rien d'autre ne s'affiche.
    // SON PROPRE GESTE NE SONNE PAS (27/11/2026) : la commande mix que Charlie envoie lui-même arrive
    // dans « À imprimer » (le filet des 20 min), sans sonner.
    const p = me();
    if (p && !enPause(p.id) && neuves.some(n => n.de !== p.id)) sonner();
  }

  // ---------- LA RELANCE DU LENDEMAIN (24/11/2026, Charlie) ----------
  // Une notification restée sans réponse la veille s'impose en plein écran dès l'ouverture, le matin :
  // on y répond (ses boutons, comme dans « Tâches »), ou on laisse une note d'information
  // (« virement attendu jeudi »), gardée chez BAT Studio sur la notification, qui reste à faire.
  // Pas de fermeture (ni Échap, ni clic à côté). Une note vaut pour la journée : le lendemain, si
  // c'est toujours en suspens, ça revient. Ne pas déranger et les messages urgents passent avant.
  const LS_RELANCE = 'olda_relance';
  const relDlg = $('#relance'), relTxt = $('#relance-txt'), relOk = $('#relance-ok');
  let relCourant = null;
  const debutJour = iso => { const d = iso ? new Date(iso) : new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  // Les notes du jour, sur l'appareil aussi : un réseau absent ne fait pas revenir la relance.
  // { qui, jour, notes: { id: { texte, at, envoyee } } }
  function notesLocales(){
    const s = store.get(LS_RELANCE), p = me();
    return s && s.qui === p?.id && s.jour === debutJour() && s.notes && typeof s.notes === 'object' ? s.notes : {};
  }
  const garderNotes = notes => store.set(LS_RELANCE, { qui: me()?.id, jour: debutJour(), notes });
  const noteDuJour = n => (n.note && Date.parse(n.note.at) >= debutJour()) || !!notesLocales()[n.id];
  function aRelancer(){
    const p = me(); if (!p || enPause(p.id)) return [];
    const auj = debutJour();
    return notifsT.filter(n => !n.lu && Date.parse(n.at) < auj && !noteDuJour(n))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }
  // Après une relève : la note locale reste visible, et celle que le réseau n'a pas prise repart.
  function reprendreNotes(){
    const notes = notesLocales(), p = me();
    for (const [id, nt] of Object.entries(notes)) {
      const n = notifsT.find(x => x.id === id); if (!n) continue;
      if (!n.note || Date.parse(n.note.at) < Date.parse(nt.at)) n.note = { texte: nt.texte, par: p?.id, at: nt.at };
      if (!nt.envoyee) envoyerNote(id, nt.texte);
    }
  }
  async function envoyerNote(id, texte){
    const p = me(); if (!p) return false;
    const r = await fetch(`${BAT_API}/api/notifs/${encodeURIComponent(id)}/note?qui=${encodeURIComponent(p.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte }) }).catch(() => null);
    // 404 : la notification n'existe plus chez BAT Studio, inutile d'insister.
    if (!r || (!r.ok && r.status !== 404)) return false;
    const notes = notesLocales(); if (notes[id]) { notes[id].envoyee = true; garderNotes(notes); }
    return true;
  }
  function relancer(){
    const file = aRelancer();
    if (relCourant && !file.some(n => n.id === relCourant.id)) relCourant = null;   // réglée ailleurs entre-temps
    if (!file.length || !ongletChef) { if (relDlg.open) relDlg.close(); relCourant = null; return; }
    $('#relance-n').textContent = file.length > 1 ? `Encore ${file.length - 1} après celle-ci` : '';
    if (relCourant) return;   // on ne touche pas à la note en cours de frappe
    if (lireDlg.open) return;   // un message urgent d'abord ; aLire nous rappelle ensuite
    const n = relCourant = file[0];
    const j = Math.round((debutJour() - debutJour(n.at)) / 864e5);
    $('#relance-depuis').textContent = j <= 1 ? 'Depuis hier' : `Depuis ${j} jours`;
    $('#relance-q').textContent = ligneNotif(n, false);
    const pj = projetNotif(n), pjEl = $('#relance-projet'); pjEl.textContent = pj; pjEl.hidden = !pj;
    const q = $('#relance-quand'); q.dateTime = n.at;
    q.textContent = `Reçue ${j === 1 ? 'hier' : jour(n.at)} à ${heure(n.at)}`;
    const av = $('#relance-avant'); av.hidden = !n.note?.texte;
    if (n.note?.texte) av.textContent = `Ta note ${jour(n.note.at) === 'Hier' ? 'd’hier' : `du ${jour(n.note.at)}`} : ${n.note.texte}`;
    const liste = reponsesNotif(n);
    $('#relance-acts').replaceChildren(...(liste.length ? liste : [{ label: 'C’est fait', cls: 'oui', fn: () => {} }]).map(a => {
      const b = el('button', 'todo-act ' + (a.cls || '')); b.type = 'button'; b.textContent = b.title = a.label;
      b.onclick = async () => {
        b.disabled = true;
        try { await a.fn(); cocherNotif(n); relCourant = null; relancer(); }
        catch (e) { toast(e.message || 'Réseau indisponible, réessaie.'); b.disabled = false; }
      };
      return b;
    }));
    relTxt.value = ''; relOk.disabled = true;
    if (!relDlg.open) { relDlg.showModal(); sonner(); }
    relDlg.scrollTop = 0;
    $('#relance-acts button')?.focus({ preventScroll: true });
  }
  relDlg.addEventListener('cancel', e => e.preventDefault());
  // Chrome ferme quand même au second Échap : on la remet aussitôt.
  relDlg.addEventListener('close', () => { if (aRelancer().length) { relCourant = null; requestAnimationFrame(relancer); } });
  relTxt.addEventListener('input', () => { relOk.disabled = relTxt.value.trim().length < 2; });
  relTxt.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $('#relance-form').requestSubmit(); } });
  $('#relance-form').onsubmit = e => {
    e.preventDefault();
    const n = relCourant, texte = relTxt.value.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!n || texte.length < 2) return;
    const at = new Date().toISOString();
    const notes = notesLocales(); notes[n.id] = { texte, at, envoyee: false }; garderNotes(notes);
    n.note = { texte, par: me()?.id, at };
    relCourant = null; renderMis(); relancer();
    envoyerNote(n.id, texte).then(ok => toast(ok ? 'Note envoyée. Elle reste dans « Tâches ».' : 'Note gardée sur cet appareil : elle partira dès que le réseau revient.'));
  };

  // --- Relever : à l'ouverture, au retour sur l'onglet, et chaque demi-minute ---
  let releveT = false;
  async function relireT(){
    const p = me(); if (!p || releveT) return;
    releveT = true;
    try {
      const c = store.get(LS_TODO);
      if (c?.aEnvoyer && c.qui === p.id) await envoyerT();
      const [rt, rn] = await Promise.all([
        fetch(`${BAT_API}/api/todo?qui=${encodeURIComponent(p.id)}`, { cache: 'no-store' }).catch(() => null),
        fetch(`${BAT_API}/api/notifs?pour=${encodeURIComponent(p.id)}`, { cache: 'no-store' }).catch(() => null),
      ]);
      if (me() !== p) return;
      const d = store.get(LS_TODO);
      if (rt?.ok && !(d?.aEnvoyer && d.qui === p.id)) {
        const { items } = await rt.json().catch(() => ({}));
        if (Array.isArray(items)) { taches = items; store.set(LS_TODO, { qui: p.id, items, aEnvoyer: false, v: 0 }); }
      }
      if (rn?.ok) {
        const { notifs } = await rn.json().catch(() => ({}));
        if (Array.isArray(notifs)) {
          notifsT = notifs; reprendreNotes(); nouvellesNotifs();
          // Revenue mais remise « à faire » ou oubliée chez BAT Studio : on n'en garde plus trace.
          const lues = new Set(notifs.filter(n => n.lu).map(n => n.id));
          revenues = new Set([...revenues].filter(id => lues.has(id)));
          rayeesA = Object.fromEntries(Object.entries(rayeesA).filter(([id]) => lues.has(id)));
          garderRev();
        }
      }
      renderTodo(); renderMis(); relancer();
    } finally { releveT = false; }
  }
  setInterval(() => { if (!document.hidden) { relireT(); relireM(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { relireT(); relireM(); } });
  addEventListener('online', () => { relireT(); relireM(); });

  function todoRelancer(){
    const p = me(), c = store.get(LS_TODO);
    taches = c && c.qui === p?.id && Array.isArray(c.items) ? c.items : [];
    notifsT = []; partantes = new Set(); lireRev(); relCourant = null; relancer();
    todo.classList.toggle('is-min', !todoPos.ouvert);
    appliquerCaches();
    if (p) { renderTodo(); relireT(); }
    misRelancer();
  }

  // ---------- Une bulle flottante : pastille ⇄ panneau, déplacée au doigt, aimantée aux bords, place gardée ----------
  // Le même geste que la discussion et la to do list. defaut({ w, h }) dit où la poser la première fois.
  function flottante({ boite, orb, panel, tete, cle, ouvert, defaut, auOuvrir, auBasculer }){
    const pos = lirePos(cle, { x: null, y: null, ouvert });
    const taille = () => pos.ouvert ? { w: panel.offsetWidth || 340, h: panel.offsetHeight || 480 } : { w: ORB, h: ORB };
    const f = { pos, vientDeGlisser: false, glisse: null };
    function borner(){
      const { w, h } = taille(), vw = innerWidth, vh = innerHeight;
      if (pos.x == null) { if (boite.hidden || vw < 200 || vh < 200) return; Object.assign(pos, defaut({ w, h })); store.set(cle, pos); }
      pos.x = Math.min(Math.max(MARGE, pos.x), Math.max(MARGE, vw - w - MARGE));
      pos.y = Math.min(Math.max(MARGE, pos.y), Math.max(MARGE, vh - h - MARGE));
    }
    f.placer = () => { borner(); boite.style.transform = `translate3d(${Math.round(pos.x)}px,${Math.round(pos.y)}px,0)`; };
    const garder = () => store.set(cle, pos);
    f.basculer = ouvrir => {
      if (ouvrir === pos.ouvert) return;
      const vw = innerWidth, vh = innerHeight;
      if (ouvrir) {
        const droite = pos.x + ORB / 2 > vw / 2, bas = pos.y + ORB / 2 > vh / 2;
        pos.ouvert = true; boite.classList.remove('is-min');
        const { w, h } = taille();
        panel.style.setProperty('--ox', droite ? '100%' : '0'); panel.style.setProperty('--oy', bas ? '100%' : '0');
        pos.x = droite ? pos.x + ORB - w : pos.x; pos.y = bas ? pos.y + ORB - h : pos.y;
        f.placer(); auOuvrir();
      } else {
        const { w, h } = taille();
        const droite = pos.x + w / 2 > vw / 2, bas = pos.y + h / 2 > vh / 2;
        pos.ouvert = false; boite.classList.add('is-min');
        pos.x = droite ? pos.x + w - ORB : pos.x; pos.y = bas ? pos.y + h - ORB : pos.y;
        f.placer();
      }
      garder(); auBasculer();
    };
    f.lacher = () => { f.glisse = null; boite.classList.remove('drag'); };
    for (const poignee of [orb, tete]) {
      poignee.addEventListener('pointerdown', e => {
        const bt = e.target.closest('button');
        if (e.button > 0 || (bt && bt !== e.currentTarget)) return;
        f.glisse = { id: e.pointerId, x0: e.clientX, y0: e.clientY, px: pos.x, py: pos.y, bouge: false };
        e.currentTarget.setPointerCapture(e.pointerId);
      });
      poignee.addEventListener('pointermove', e => {
        const g = f.glisse; if (!g || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
        if (!g.bouge && Math.hypot(dx, dy) < 3) return;
        if (!g.bouge) { g.bouge = true; boite.classList.add('drag'); boite.style.transition = 'none'; }
        pos.x = g.px + dx; pos.y = g.py + dy; f.placer();
      });
      const lacher = e => {
        const g = f.glisse; if (!g || e.pointerId !== g.id) return;
        f.lacher(); if (!g.bouge) return;
        f.vientDeGlisser = true; setTimeout(() => { f.vientDeGlisser = false; }, 0);
        borner();
        const { w, h } = taille(), dX = innerWidth - w - MARGE, dY = innerHeight - h - MARGE;
        const colle = v => v - MARGE < AIMANT ? MARGE : null;
        const x = colle(pos.x) ?? (dX - pos.x < AIMANT ? dX : pos.x), y = colle(pos.y) ?? (dY - pos.y < AIMANT ? dY : pos.y);
        boite.style.transition = (x !== pos.x || y !== pos.y) && !reduced.matches ? 'transform .45s cubic-bezier(.34,1.4,.64,1)' : '';
        pos.x = x; pos.y = y; f.placer(); garder();
      };
      poignee.addEventListener('pointerup', lacher);
      poignee.addEventListener('pointercancel', lacher);
    }
    boite.addEventListener('transitionend', () => { boite.style.transition = ''; });
    boite.addEventListener('pointerdown', () => devant(boite), true);
    orb.onclick = () => { if (!f.vientDeGlisser && !appuiLongPris()) f.basculer(true); };
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); f.basculer(false); orb.focus(); } });
    return f;
  }

  // ---------- Les tâches que Loïc donne (24/11/2026) : BAT Studio, /api/taches (server/taches.mjs) ----------
  // « Une bulle où l'on reçoit uniquement ce qu'on doit faire. Depuis Tâches, Loïc doit pouvoir nous envoyer
  // des tâches, comme vider les poubelles ; une fois terminé on valide la tâche et Loïc est informé. »
  // Chacun : ses tâches reçues, cochées ici (celles faites restent rayées jusqu'au soir : un doigt qui glisse
  // se rattrape). Loïc : écrire, toucher les prénoms, envoyer ; il voit qui a fini (son, pastille, message).
  // Depuis le 25/11/2026, les notifications pour moi (BAT, paiements, PRT…) arrivent ici aussi, pour chacun,
  // Loïc compris : tout ce qu'on doit faire est dans Tâches. La To Do List (au-dessus) reste à soi seul.
  // LE CENTRE (25/11/2026, Charlie : « tout doit se gérer depuis le centre, ils n'ont plus qu'à valider ou non ») :
  // Tâches est la bulle blanche. Loïc envoie ses tâches depuis la discussion (bouton Tâche) et les suit
  // ici, sous les siennes : qui a fini, en cours, effacer les terminées. La bulle « Pour l'équipe » est retirée.
  const CHEFS = ['loic'];
  const LS_MIS = 'olda_taches', LS_MIS_POS = 'olda_taches_pos', LS_MIS_VUS = 'olda_taches_vus';
  const mis = $('#mis'), misOrb = $('#mis-orb'), misList = $('#mis-list');
  let missions = [], misRayes = new Set(), misEclat = new Set(), releveM = false;
  const misVus = new Set(store.get(LS_MIS_VUS) || []);
  const misAttente = new Map();   // id → fait, le temps que BAT Studio confirme (une relève ne la décoche pas entre-temps)
  const chef = () => CHEFS.includes(me()?.id);
  const aujourdhui = iso => !!iso && new Date(iso).toDateString() === new Date().toDateString();
  const recues = () => { const p = me(); return missions.filter(t => t.pour === p?.id && (!t.fait || aujourdhui(t.fait))); };
  const donnees = () => { const p = me(); return missions.filter(t => t.de === p?.id); };
  const misNom = id => profilDe(id)?.name || '?';
  const misF = flottante({
    // Ouverte d'office sur le Dashboard quand elle tient à côté de la discussion ouverte.
    boite: mis, orb: misOrb, panel: $('#mis-panel'), tete: $('#mis-head'), cle: LS_MIS_POS, ouvert: DASHBOARD && innerWidth >= 960,
    // La première fois : à gauche de la To Do List (ou de la discussion si elle est cachée).
    defaut: ({ w, h }) => enBasADroite(rectTodo() || rectChat(), w, h),
    auOuvrir: () => { devant(mis); misOrb.classList.remove('has-new'); voirMis(); relireM(); relireT(); },
    auBasculer: () => majCompteM(),
  });
  $('#mis-x').onclick = () => misF.basculer(false);
  const garderMis = () => store.set(LS_MIS, { qui: me()?.id, taches: missions.filter(t => !t.wait) });
  const posterM = async (chemin, corps) => {
    const r = await fetch(`${BAT_API}/api/taches${chemin}?qui=${encodeURIComponent(me()?.id || '')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Réseau indisponible, réessaie.'), { statut: r.status });
    return j;
  };

  // --- Afficher ---
  function majCompteM(){
    const a = recues().filter(t => !t.fait).length + notifsAFaire().length, fin = donnees().filter(t => t.fait && !t.vu).length, enCours = donnees().filter(t => !t.fait).length;
    const n = a + fin, c = $('#mis-n'), finT = fin && `${fin} terminée${fin > 1 ? 's' : ''}`;
    c.hidden = !n || misF.pos.ouvert; c.textContent = n > 9 ? '9+' : String(n);
    $('#mis-c').textContent = [a && `${a} à faire`, finT, enCours && `${enCours} en cours`].filter(Boolean).join(' · ');
    misOrb.setAttribute('aria-label', n ? `Tâches : ${[a && `${a} à faire`, finT].filter(Boolean).join(', ')}` : 'Ouvrir mes tâches');
  }
  function renderMis(){
    const p = me(); if (!p) return;
    const recent = t => Date.parse(t.fait || t.at) || 0, out = [];
    // Les miennes : celles que Loïc m'a données (la plus récente en haut), les notifications,
    // puis les tâches faites aujourd'hui.
    const recue = t => {
      const li = ligneT({ texte: t.texte, quand: t.fait || t.at, qui: t.fait ? 'Fait' : `De ${misNom(t.de)}`, fait: !!t.fait, cocher: () => cocherMis(t) });
      if (misRayes.has(t.id)) li.classList.add('raye');
      return li;
    };
    const miennes = recues().sort((a, b) => recent(b) - recent(a));
    out.push(...miennes.filter(t => !t.fait).map(recue), ...lignesNotifs(), ...miennes.filter(t => t.fait).map(recue));
    // Celles que j'ai données (Loïc) : les juste finies, puis en cours, puis les finies déjà vues.
    const rang = t => t.fait ? (t.vu && !misEclat.has(t.id) ? 2 : 0) : 1;
    for (const t of donnees().sort((a, b) => rang(a) - rang(b) || recent(b) - recent(a))) {
      const li = ligneT({ texte: t.texte, quand: t.fait || t.at, qui: t.fait ? `✓ Fait par ${misNom(t.pour)}` : `Pour ${misNom(t.pour)}`, fait: !!t.fait, suppr: t.wait ? null : () => retirerMis(t) });
      if (t.wait) li.classList.add('wait');
      if (misEclat.has(t.id)) li.classList.add('revient');
      out.push(li);
    }
    if (!out.length) { const v = el('li', 'todo-vide'); v.textContent = 'Aucune tâche pour l’instant ✌️'; out.push(v); }
    misList.replaceChildren(...out);
    misRayes = new Set(); misEclat = new Set();
    const finies = donnees().filter(t => t.fait).length, vider = $('#mis-vider');
    vider.hidden = !finies; vider.textContent = `Effacer les terminées (${finies})`;
    const retours = aFaireRevenir().length, revenir = $('#mis-revenir');
    revenir.hidden = !retours; revenir.textContent = `↶ Faire revenir (${retours})`;
    revenir.title = `Faire revenir la dernière notification rayée (${MAC ? '⌘' : 'Ctrl'} Z)`;
    $('#mis-pied').hidden = vider.hidden && revenir.hidden;
    majCompteM();
  }
  // --- Cocher : aussitôt chez moi, Loïc l'apprend à sa prochaine relève ---
  async function cocherMis(t){
    const avant = t.fait, fait = !t.fait;
    t.fait = fait ? new Date().toISOString() : null; t.vu = null;
    misAttente.set(t.id, t.fait);
    if (fait) misRayes.add(t.id);
    garderMis(); renderMis();
    try {
      const { tache } = await posterM(`/${encodeURIComponent(t.id)}/fait`, { fait });
      if (tache) Object.assign(t, tache);
      if (fait) toast(`Bravo ! ${misNom(t.de)} est prévenu.`);
    } catch (e) {
      if (e.statut === 404) missions = missions.filter(x => x !== t);   // retirée par Loïc entre-temps
      else t.fait = avant;
      toast(e.message);
    } finally { misAttente.delete(t.id); garderMis(); renderMis(); }
  }

  // --- Donner (Loïc, depuis la discussion) : la ligne paraît tout de suite, en attente, puis BAT Studio la confirme ---
  async function donnerTache(brut, pour){
    const p = me(), texte = String(brut || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!p || !texte || !pour.length) return true;
    const at = new Date().toISOString();
    const temp = pour.map(x => ({ id: 'w' + nouvelId(), de: p.id, pour: x, texte, at, fait: null, vu: null, wait: true }));
    missions = [...temp, ...missions]; renderMis();
    let ok = true;
    try {
      const { taches = [] } = await posterM('', { texte, pour });
      missions = [...taches, ...missions.filter(t => !temp.includes(t))];
      toast(`Tâche envoyée à ${pour.map(misNom).join(', ').replace(/, ([^,]*)$/, ' et $1')}.`);
    } catch (err) {
      missions = missions.filter(t => !temp.includes(t)); ok = false;
      toast(err.statut ? err.message : 'Réseau indisponible : la tâche n’est pas partie.');
    }
    garderMis(); renderMis();
    return ok;
  }
  async function retirerMis(t){
    const avant = missions;
    missions = missions.filter(x => x !== t); garderMis(); renderMis();
    try { await posterM(`/${encodeURIComponent(t.id)}/retirer`); }
    catch (e) { missions = avant; garderMis(); renderMis(); toast(e.message); }
  }
  $('#mis-vider').onclick = async () => {
    const avant = missions, p = me();
    missions = missions.filter(t => !(t.de === p?.id && t.fait)); garderMis(); renderMis();
    try { await posterM('/effacer'); }
    catch (e) { missions = avant; garderMis(); renderMis(); toast(e.message); }
  };
  // Loïc a la bulle ouverte sous les yeux : les tâches finies sont vues (elles s'éclairent une fois).
  function voirMis(){
    const l = donnees().filter(t => t.fait && !t.vu);
    if (!l.length || !misF.pos.ouvert || document.hidden) return;
    const at = new Date().toISOString();
    l.forEach(t => { t.vu = at; misEclat.add(t.id); });
    garderMis(); renderMis();
    posterM('/vu').catch(() => {});
  }

  // --- Du neuf : une tâche pour moi, ou (Loïc) une tâche finie. Le son de la bulle, une fois. ---
  function nouveautesM(){
    const p = me(); if (!p) return;
    const cle = t => t.pour === p.id ? 'r' + t.id : `f${t.id}/${t.fait}`;
    const neuves = missions.filter(t => !t.wait && ((t.pour === p.id && !t.fait) || (t.de === p.id && t.fait && !t.vu)) && !misVus.has(cle(t)));
    if (!neuves.length) return;
    neuves.forEach(t => misVus.add(cle(t))); store.set(LS_MIS_VUS, [...misVus].slice(-300));
    const finies = neuves.filter(t => t.de === p.id), recue = neuves.filter(t => t.pour === p.id);
    if (!misF.pos.ouvert) misOrb.classList.add('has-new');
    $('#rappel').classList.add('neuf');
    if (!enPause(p.id)) sonner();
    if (finies.length === 1) toast(`${misNom(finies[0].pour)} a terminé : ${finies[0].texte}`);
    else if (finies.length > 1) toast(`${finies.length} tâches terminées`);
    else if (recue.length === 1) toast(`Nouvelle tâche de ${misNom(recue[0].de)} : ${recue[0].texte}`);
    else toast(`${recue.length} nouvelles tâches`);
  }
  async function relireM(){
    const p = me(); if (!p || releveM) return;
    releveM = true;
    try {
      const r = await fetch(`${BAT_API}/api/taches?qui=${encodeURIComponent(p.id)}`, { cache: 'no-store' }).catch(() => null);
      if (!r?.ok || me() !== p) return;
      const { taches } = await r.json().catch(() => ({}));
      if (!Array.isArray(taches)) return;
      for (const t of taches) if (misAttente.has(t.id)) t.fait = misAttente.get(t.id);
      missions = [...missions.filter(t => t.wait), ...taches];
      garderMis(); nouveautesM(); renderMis(); voirMis();
    } finally { releveM = false; }
  }
  function misRelancer(){
    const p = me(), c = store.get(LS_MIS);
    missions = c && c.qui === p?.id && Array.isArray(c.taches) ? c.taches : [];
    mis.classList.toggle('is-min', !misF.pos.ouvert);
    if (p) { renderMis(); relireM(); }
  }

  // --- Cacher / afficher, site par site : clic droit, ou appui long au doigt ---
  const ctx = $('#ctx'), rappel = $('#rappel');
  function appliquerCaches(){
    const p = me();
    chat.hidden = (!p && DASHBOARD) || caches.chat;
    todo.hidden = !p || caches.todo;
    mis.hidden = !p || caches.mis;
    rappel.hidden = !(chat.hidden && todo.hidden && mis.hidden && (caches.chat || caches.todo || caches.mis));
    if (!chat.hidden) placer();
    if (!todo.hidden) placerT();
    if (!mis.hidden) misF.placer();
  }
  function cacher(k, v){
    caches[k] = v; store.set(LS_CACHES, caches); ctx.hidden = true;
    appliquerCaches();
    const nom = { todo: 'La To Do List', mis: 'La bulle Tâches', chat: 'La messagerie' }[k];
    toast(!v ? `${nom} est de retour.` : [chat, todo, mis].every(b => b.hidden) ? 'Tout est caché sur ce site : le petit point en bas à droite les remet.' : `${nom} est cachée sur ce site. Clic droit sur une autre bulle pour la remettre.`);
  }
  const ICO_CACHER = '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 5 10 7a17 17 0 0 1-3.2 4.2"/><path d="M6.6 6.6A17 17 0 0 0 2 12c1 2 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>';
  const ICO_VOIR = '<path d="M2 12c1-2 5-7 10-7s9 5 10 7c-1 2-5 7-10 7S3 14 2 12z"/><circle cx="12" cy="12" r="3"/>';
  function ouvrirCtx(x, y){
    const ligne = (txt, ico, fn) => { const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.innerHTML = SVG(ico); b.append(txt); b.onclick = fn; return b; };
    ctx.replaceChildren(
      ligne(caches.todo ? 'Afficher la To Do List' : 'Cacher la To Do List', caches.todo ? ICO_VOIR : ICO_CACHER, () => cacher('todo', !caches.todo)),
      ligne(caches.mis ? 'Afficher les Tâches' : 'Cacher les Tâches', caches.mis ? ICO_VOIR : ICO_CACHER, () => cacher('mis', !caches.mis)),
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
  for (const n of [chat, todo, mis, rappel]) n.addEventListener('contextmenu', surClicDroit);
  rappel.onclick = () => { rappel.classList.remove('neuf'); ouvrirCtx(innerWidth, innerHeight - 52); };   // juste au-dessus du point
  document.addEventListener('pointerdown', e => { if (!ctx.hidden && !ctx.contains(e.composedPath()[0])) ctx.hidden = true; });
  ctx.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); ctx.hidden = true; } });
  // Au doigt (iPhone : pas de clic droit), un appui long sur la pastille ou l'en-tête ouvre le même menu.
  let appui = null, appuiLong = false;
  const appuiLongPris = () => { const v = appuiLong; appuiLong = false; return v; };
  for (const n of [chatOrb, $('#chat-head'), todoOrb, $('#todo-head'), misOrb, $('#mis-head')]) {
    n.style.webkitTouchCallout = 'none';
    n.addEventListener('pointerdown', e => {
      appuiLong = false;
      if (e.pointerType === 'mouse') return;
      clearTimeout(appui?.t);
      const x = e.clientX, y = e.clientY;
      appui = { x, y, t: setTimeout(() => { appui = null; appuiLong = true; glisse = null; glisseT = null; misF.lacher(); chat.classList.remove('drag'); todo.classList.remove('drag'); ouvrirCtx(x, y); }, 550) };
    });
    n.addEventListener('pointermove', e => { if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 10) { clearTimeout(appui.t); appui = null; } });
    for (const t of ['pointerup', 'pointercancel']) n.addEventListener(t, () => { if (appui) { clearTimeout(appui.t); appui = null; } });
  }

  function chatRelancer(){
    poserHabit();
    const p = me(); chat.classList.toggle('sans-nom', !p);
    chat.classList.toggle('is-min', !chatPos.ouvert);   // avant todoRelancer : la discussion se mesure ouverte ou en pastille pour poser les autres à côté
    todoRelancer();
    if (!p) { if (chatWs) { chatWs.onclose = null; chatWs.close(); chatWs = null; } clearInterval(chatSonde); chatSonde = null; renderQui(); placer(); return; }
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

  // ---------- L'info au survol (24/11/2026, Charlie : « qu'elle s'affiche pratiquement instantanément ») ----------
  // L'infobulle du navigateur (title) attend ~1 s. Ici 0,15 s : assez pour ne pas clignoter quand la souris ne
  // fait que passer, et d'une bulle à l'autre elle suit tout de suite. Sur les deux pastilles, l'état en direct
  // (qui m'a écrit et quoi, qui est là, ce qui attend dans Tâches et la To Do List) ; il se refait s'il change sous la souris.
  // Tous les title de la bulle passent par elle (gardés en aria-description pour les lecteurs d'écran).
  const info = $('#info'), INFO_DELAI = 150, INFO_CHAUD = 500, INFO_MAX = 5;
  const INFO_SEL = '#chat-orb, #todo-orb, #mis-orb, [data-info]';
  const survol = matchMedia('(hover:hover)');
  let infoCible = null, infoTempo = null, infoFin = 0, infoXY = null, infoRaf = 0;
  const extrait = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
  function versInfo(n){
    const t = n.getAttribute('title'); n.removeAttribute('title');
    if (t) { n.dataset.info = t; n.setAttribute('aria-description', t); }
  }
  function infoChat(){
    const p = me(); if (!p) return ['Discussion de l’équipe', 'Toucher pour choisir ton prénom'];
    const fils = [{ id: 'tous', name: 'Équipe' }, ...PROFILES.filter(x => x.id !== p.id)].map(f => [f, nonLus(f.id)]).filter(([, n]) => n);
    const tot = fils.reduce((t, [, n]) => t + n, 0);
    const l = [tot ? `${pluriel(tot, 'message')} non lu${tot > 1 ? 's' : ''}` : 'Discussion · rien de nouveau'];
    for (const [f, n] of fils) {
      const m = msgs.filter(x => filDe(x) === f.id && !x.wait && x.de !== p.id).at(-1);
      const de = f.id === 'tous' && m ? (profilDe(m.de)?.name || '') + ' : ' : '';
      l.push(`${f.name} (${n}) — ${de}${!m ? '' : m.vocal ? 'note vocale' : `« ${extrait(m.texte, 60)} »`}`);
    }
    const autres = PROFILES.filter(x => x.id !== p.id);
    const ecrit = autres.filter(x => tapeurs.has(x.id)).map(x => x.name);
    if (ecrit.length) l.push(`${ecrit.join(' et ')} ${ecrit.length > 1 ? 'écrivent' : 'écrit'}…`);
    if (chatMode === 'coupe') l.push('Reconnexion…');
    else { const la = autres.filter(x => presents.includes(x.id)).map(x => x.name); l.push(la.length ? `● En ligne : ${la.join(', ')}` : 'Personne d’autre en ligne'); }
    for (const x of autres) if (enPause(x.id)) l.push(`${x.name} en pause jusqu’à ${heure(pauses[x.id])}`);
    if (enPause(p.id)) l.push(`Ne pas déranger : toi, jusqu’à ${heure(pauses[p.id])}`);
    return l;
  }
  function infoTodo(){
    if (!me()) return null;
    const tout = taches.filter(t => !t.fait).map(t => t.texte), n = tout.length;
    if (!n) return ['To Do List · rien à faire'];
    return [`${n} à faire`, ...tout.slice(0, INFO_MAX).map(x => '• ' + extrait(x, 70)), ...(n > INFO_MAX ? [`+ ${pluriel(n - INFO_MAX, 'autre')}`] : [])];
  }
  function infoMis(){
    if (!me()) return null;
    const a = [...recues().filter(t => !t.fait).map(t => t.texte), ...notifsAFaire().map(ligneEtProjet)];
    const fin = donnees().filter(t => t.fait && !t.vu), enCours = donnees().filter(t => !t.fait);
    if (!a.length && !fin.length && !enCours.length) return ['Tâches · rien à faire'];
    const l = [];
    if (a.length) l.push(`${a.length} à faire`, ...a.slice(0, INFO_MAX).map(x => '• ' + extrait(x, 70)), ...(a.length > INFO_MAX ? [`+ ${pluriel(a.length - INFO_MAX, 'autre')}`] : []));
    if (fin.length) l.push(`${pluriel(fin.length, 'tâche')} terminée${fin.length > 1 ? 's' : ''}`, ...fin.slice(0, INFO_MAX).map(t => `✓ ${misNom(t.pour)} : ${extrait(t.texte, 60)}`));
    if (enCours.length) l.push(`${enCours.length} en cours`);
    return l;
  }
  function infoMontrer(){
    const c = infoCible, r = c?.isConnected && c.getBoundingClientRect();
    const l = r && r.width && (c === chatOrb ? infoChat() : c === todoOrb ? infoTodo() : c === misOrb ? infoMis() : [c.dataset.info]);
    if (!l?.[0]) return infoCacher();
    const [t, ...reste] = l, b = el('b'); b.textContent = t;
    info.replaceChildren(b, ...reste.map(x => { const s = el('span'); s.textContent = x; return s; }));
    // Au-dessus de ce qu'on survole, sinon dessous ; toujours dans l'écran.
    const w = info.offsetWidth, h = info.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    const y = r.top - h - 10 >= 8 ? r.top - h - 10 : Math.min(r.bottom + 10, innerHeight - h - 8);
    info.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    info.classList.add('on');
  }
  function infoCacher(){
    clearTimeout(infoTempo); infoCible = null;
    if (info.classList.contains('on')) { infoFin = Date.now(); info.classList.remove('on'); }
  }
  function infoViser(c){
    if (c === infoCible) return;
    const chaud = info.classList.contains('on') || Date.now() - infoFin < INFO_CHAUD;
    clearTimeout(infoTempo); infoCible = c;
    if (!c) return infoCacher();
    if (c.hasAttribute('title')) versInfo(c);
    if (chaud) infoMontrer(); else infoTempo = setTimeout(infoMontrer, INFO_DELAI);
  }
  root.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch' || !survol.matches || e.buttons || glisse || glisseT || misF.glisse) return;
    infoXY = [e.clientX, e.clientY];
    const c = e.target.closest?.(INFO_SEL + ', [title]');
    if (c) infoViser(c);
  });
  root.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') infoXY = [e.clientX, e.clientY]; }, { passive: true });
  root.addEventListener('pointerout', e => { if (infoCible && !infoCible.contains(e.relatedTarget)) infoCacher(); });
  root.addEventListener('pointerdown', infoCacher, true);
  root.addEventListener('wheel', infoCacher, { passive: true });
  root.addEventListener('scroll', infoCacher, true);
  addEventListener('blur', infoCacher);
  // Plus aucune infobulle lente : chaque title posé dans la bulle devient une info rapide. Et ce qui change sous
  // la souris (un message arrive, quelqu'un se connecte, une tâche est cochée) refait l'info tout de suite.
  root.querySelectorAll('[title]').forEach(versInfo);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'attributes') { if (m.target.hasAttribute('title')) versInfo(m.target); continue; }
      for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.hasAttribute('title')) versInfo(n); n.querySelectorAll('[title]').forEach(versInfo); }
    }
    if (!infoCible || infoRaf || ms.every(m => info.contains(m.target))) return;
    infoRaf = requestAnimationFrame(() => {
      infoRaf = 0; if (!infoCible) return;
      // La liste des conversations se redessine : on retrouve ce qui est sous la souris.
      if (!infoCible.isConnected) { infoCible = infoXY && root.elementFromPoint(...infoXY)?.closest?.(INFO_SEL) || null; }
      if (info.classList.contains('on')) infoMontrer();
    });
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label'] });

  (document.body || document.documentElement).append(hote);
  chatRelancer();
  window.oldaBulle = { relancer: chatRelancer, ouvrir: () => basculer(true), todo: () => { basculerT(true); devant(todo); }, taches: () => { misF.basculer(true); devant(mis); } };
})();
