/**
 * Node module hooks that let plain `node` load the site's TypeScript modules the
 * way Next.js does, for scripts such as check-content.mjs: the `@/` alias maps
 * to src/, and extensionless relative imports find their .ts/.tsx file. Node
 * itself strips the types (Node 22.18+). No dependencies.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = new URL('../../src/', import.meta.url);
const HAS_EXTENSION = /\.(?:[cm]?[jt]sx?|json)$/;

export async function resolve(specifier, context, nextResolve) {
  let url = null;
  if (specifier.startsWith('@/')) url = new URL(specifier.slice(2), src);
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    url = new URL(specifier, context.parentURL);
  }
  if (url && !HAS_EXTENSION.test(url.pathname)) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const candidate = fileURLToPath(url) + ext;
      if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(url ? url.href : specifier, context);
}
