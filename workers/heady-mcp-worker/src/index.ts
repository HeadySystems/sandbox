export interface Env {
  MCP_SESSIONS: DurableObjectNamespace;
}

const toolManifest = [
  { name: 'chat', description: 'Route chat requests into Heady services' },
  { name: 'search', description: 'Search memory and approved services' },
  { name: 'deploy', description: 'Create governed deployment requests' },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/tools') {
      return Response.json({ tools: toolManifest, transport: ['streamable_http', 'sse'] });
    }
    if (url.pathname === '/mcp') {
      return Response.json({ protocol: 'json-rpc-2.0', transport: 'streamable_http', stateful: true });
    }
    if (url.pathname === '/sse') {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: ready\ndata: {"ok":true}\n\n'));
          controller.close();
        }
      });
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
    }
    return new Response('Not Found', { status: 404 });
  }
};
