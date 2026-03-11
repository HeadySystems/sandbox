import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-autobiographer",
          "version": "0.1.0",
          "port": 4312,
          "summary": "Narrative logging, decision lineage, and daily briefing material.",
          "routes": [
                    "/story/append",
                    "/story/recent"
          ],
          "dependencies": [
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/story/append', async () => ({ route: '/story/append', ok: true }));
            app.get('/story/recent', async () => ({ route: '/story/recent', ok: true }));

        const port = Number(process.env.PORT ?? 4312);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-autobiographer listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
