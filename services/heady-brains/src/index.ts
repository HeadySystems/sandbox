import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-brains",
          "version": "0.1.0",
          "port": 4307,
          "summary": "Context assembly, capsules, and model prompt preparation.",
          "routes": [
                    "/context/build",
                    "/context/capsule"
          ],
          "dependencies": [
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/context/build', async () => ({ route: '/context/build', ok: true }));
            app.get('/context/capsule', async () => ({ route: '/context/capsule', ok: true }));

        const port = Number(process.env.PORT ?? 4307);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-brains listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
