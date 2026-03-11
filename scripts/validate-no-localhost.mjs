import { readFileSync, statSync, readdirSync } from 'node:fs';
    import { join, relative } from 'node:path';

    const root = new URL('../', import.meta.url).pathname;
    const offenders = [];
    const includeRoots = ['services', 'workers', 'packages', 'configs', 'infra/cloud-run', '.env.example'];
    const endpointPattern = /https?:\/\/[^\s'"]*(localhost|127\.0\.0\.1)|\b(localhost|127\.0\.0\.1):(\d+)/g;

    function shouldScan(path) {
      const rel = relative(root, path).replaceAll('\\', '/');
      return includeRoots.some((item) => rel === item || rel.startsWith(`${item}/`));
    }

    function walk(dir) {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
          if (['node_modules', '.git', 'dist', 'docs', 'directives', 'artifacts'].includes(entry)) continue;
          walk(path);
          continue;
        }
        if (!shouldScan(path)) continue;
        const content = readFileSync(path, 'utf8');
        if (endpointPattern.test(content)) offenders.push(relative(root, path));
      }
    }

    walk(root);
    if (offenders.length) {
      console.error('Forbidden local endpoint references found:');
      console.error(offenders.join('
'));
      process.exit(1);
    }
    console.log('No localhost endpoint references found in deployable surfaces.');
