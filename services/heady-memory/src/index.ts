import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-memory",
          "version": "0.1.0",
          "port": 4304,
          "summary": "pgvector-backed memory search, graph relations, and Vectorize sync.",
          "routes": [
                    "/memory/search",
                    "/memory/upsert"
          ],
          "dependencies": [
                    "csl-gate",
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);


            app.post('/memory/search', async (request) => ({
              mode: 'hybrid',
              topK: 13,
              query: request.body,
              originStore: 'pgvector',
              edgeStore: 'vectorize',
            }));
            app.post('/memory/upsert', async (request) => ({ accepted: true, body: request.body }));


        const port = Number(process.env.PORT ?? 4304);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-memory listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
