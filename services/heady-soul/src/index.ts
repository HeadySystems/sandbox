import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-soul",
          "version": "0.1.0",
          "port": 4308,
          "summary": "Policy values, alignment checks, and output certification.",
          "routes": [
                    "/alignment/check",
                    "/alignment/certify"
          ],
          "dependencies": [
                    "csl-gate"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/alignment/check', async () => ({ route: '/alignment/check', ok: true }));
            app.get('/alignment/certify', async () => ({ route: '/alignment/certify', ok: true }));

        const port = Number(process.env.PORT ?? 4308);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-soul listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
