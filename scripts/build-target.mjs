import { spawnSync } from 'node:child_process';

// Preserve the Next.js build added for conventional hosting. The existing
// Sites publication uses its Cloudflare adapter through an explicit target.
const args = process.env.VARTA_BUILD_TARGET === 'cloudflare'
  ? ['scripts/run-framework.mjs', 'build']
  : ['node_modules/next/dist/bin/next', 'build'];
const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
