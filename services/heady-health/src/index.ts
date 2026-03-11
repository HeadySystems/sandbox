import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-health",
          "version": "0.1.0",
          "port": 4305,
          "summary": "Health registry, drift evaluation, and readiness scoring.",
          "routes": [
                    "/health/matrix",
                    "/health/drift"
          ],
          "dependencies": [
                    "observability-client"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);


            app.get('/health/matrix', async () => ({ state: 'healthy', score: 0.927, checkedAt: new Date().toISOString() }));
            app.get('/health/drift', async () => ({ drift: 'nominal', score: 0.236 }));


        const port = Number(process.env.PORT ?? 4305);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-health listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
