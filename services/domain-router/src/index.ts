import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "domain-router",
          "version": "0.1.0",
          "port": 4301,
          "summary": "Environment-aware URL resolution and domain policy enforcement.",
          "routes": [
                    "/resolve",
                    "/domain/:host"
          ],
          "dependencies": [
                    "config-core"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);


            import { resolveDomain } from '@heady-ai/config-core';

            app.get('/resolve', async (request) => {
              const host = String((request.query as Record<string, string>).host ?? '');
              return { host, resolved: resolveDomain(host) };
            });

            app.get('/domain/:host', async (request) => {
              const host = String((request.params as Record<string, string>).host);
              return { host, resolved: resolveDomain(host) };
            });


        const port = Number(process.env.PORT ?? 4301);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`domain-router listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
