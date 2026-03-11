import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-vinci",
          "version": "0.1.0",
          "port": 4309,
          "summary": "Pattern learning, scenario ranking, and plan enrichment.",
          "routes": [
                    "/patterns/score",
                    "/patterns/learn"
          ],
          "dependencies": [
                    "csl-gate"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/patterns/score', async () => ({ route: '/patterns/score', ok: true }));
            app.get('/patterns/learn', async () => ({ route: '/patterns/learn', ok: true }));

        const port = Number(process.env.PORT ?? 4309);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-vinci listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
