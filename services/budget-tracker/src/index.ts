import { createServiceApp } from '@heady-ai/service-runtime';
        import type { ServiceManifest } from '@heady-ai/contract-types';

        const manifest: ServiceManifest = {
          "name": "budget-tracker",
          "version": "0.1.0",
          "port": 4303,
          "summary": "Provider budgets, spend envelopes, and throttle decisions.",
          "routes": [
                    "/budget/current",
                    "/budget/provider/:provider"
          ],
          "dependencies": [
                    "contract-types"
          ]
} as ServiceManifest;
        const app = createServiceApp(manifest);


            app.get('/budget/current', async () => ({ totalBudgetUsd: 233, currentSpendUsd: 0, health: 'green' }));
            app.get('/budget/provider/:provider', async (request) => ({ provider: (request.params as Record<string, string>).provider, spendUsd: 0 }));


        const port = Number(process.env.PORT ?? 4303);
        app.listen({ port, host: '0.0.0.0' }).then(() => {
          app.log.info(`budget-tracker listening on ${port}`);
        }).catch((error) => {
          app.log.error(error);
          process.exit(1);
        });
