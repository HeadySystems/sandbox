export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/verify') {
      return Response.json({ ok: true, auth: 'cloudflare-access+jwt+ed25519' });
    }
    if (url.pathname === '/token/introspect') {
      return Response.json({ active: true, scope: ['internal'] });
    }
    return new Response('Not Found', { status: 404 });
  }
};
