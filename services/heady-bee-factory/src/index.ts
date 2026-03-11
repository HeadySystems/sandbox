import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-bee-factory",
          "version": "0.1.0",
          "port": 4313,
          "summary": "Bee registration, pool scaling, and lifecycle orchestration.",
          "routes": [
                    "/bees/spawn",
                    "/bees/topology"
          ],
          "dependencies": [
                    "phi-math-foundation",
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/bees/spawn', async () => ({ route: '/bees/spawn', ok: true }));
            app.get('/bees/topology', async () => ({ route: '/bees/topology', ok: true }));

        const port = Number(process.env.PORT ?? 4313);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-bee-factory listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
