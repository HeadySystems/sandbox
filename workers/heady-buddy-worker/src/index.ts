export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/chat') {
      return Response.json({ surface: 'heady-buddy', mode: 'interactive' });
    }
    if (url.pathname === '/stream') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message\ndata: {"surface":"heady-buddy","ok":true}\n\n'));
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    }
    if (url.pathname === '/resume') {
      return Response.json({ resumable: true });
    }
    return new Response('Not Found', { status: 404 });
  }
};
