import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-guard",
          "version": "0.1.0",
          "port": 4311,
          "summary": "Validation, sanitization, and zero-trust request inspection.",
          "routes": [
                    "/sanitize",
                    "/scan/request"
          ],
          "dependencies": [
                    "zod-schemas"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/sanitize', async () => ({ route: '/sanitize', ok: true }));
            app.get('/scan/request', async () => ({ route: '/scan/request', ok: true }));

        const port = Number(process.env.PORT ?? 4311);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-guard listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
