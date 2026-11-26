// Le Dashboard sur olda.myolda.com (25/11/2026), derrière Cloudflare Access avec les applis OLDA.
// Ce Worker ne garde aucune copie : il relaie GitHub Pages (dockbearolda.github.io), donc un « push » sur
// main suffit toujours à mettre le Dashboard à jour, aux deux adresses.
// /olda-bat/api/… → BAT Studio par la liaison de service : la bulle (bulle.js) parle à BAT Studio depuis la
// même adresse que la page, le cookie Cloudflare Access suit.
const PAGES = 'https://dockbearolda.github.io';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/olda-bat/')) {
      const chemin = url.pathname.slice('/olda-bat'.length);
      if (!chemin.startsWith('/api/')) return new Response('Introuvable', { status: 404 });
      return env.BAT.fetch(new Request('https://bat.myolda.com' + chemin + url.search, request));
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
    const r = await fetch(PAGES + url.pathname + url.search, { method: request.method, headers: { Accept: request.headers.get('Accept') || '*/*' } });
    const h = new Headers(r.headers);
    for (const k of ['x-github-request-id', 'x-fastly-request-id', 'x-served-by', 'x-cache', 'x-cache-hits', 'x-timer', 'via', 'x-proxy-cache']) h.delete(k);
    // Rien d'ici ne se met dans le cadre d'un autre site.
    if ((h.get('Content-Type') || '').includes('text/html')) h.set('Content-Security-Policy', "frame-ancestors 'self'");
    return new Response(r.body, { status: r.status, headers: h });
  },
};
