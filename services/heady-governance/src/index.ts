import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-governance",
          "version": "0.1.0",
          "port": 4310,
          "summary": "Protected action gates, audit decisions, and policy attestations.",
          "routes": [
                    "/governance/pre",
                    "/governance/post"
          ],
          "dependencies": [
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);

                    app.get('/governance/pre', async () => ({ route: '/governance/pre', ok: true }));
            app.get('/governance/post', async () => ({ route: '/governance/post', ok: true }));

        const port = Number(process.env.PORT ?? 4310);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-governance listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
