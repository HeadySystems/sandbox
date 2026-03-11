import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "heady-conductor",
          "version": "0.1.0",
          "port": 4306,
          "summary": "Intent routing, pool assignment, and cross-service orchestration.",
          "routes": [
                    "/route",
                    "/plan"
          ],
          "dependencies": [
                    "csl-gate",
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);


            app.post('/route', async (request) => ({
              taskType: 'general',
              pool: 'hot',
              service: 'hcfullpipeline-executor',
              confidence: 0.882,
              request: request.body,
            }));
            app.post('/plan', async (request) => ({ steps: ['recon', 'plan', 'trial-and-error', 'execute-major-phase'], request: request.body }));


        const port = Number(process.env.PORT ?? 4306);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`heady-conductor listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
