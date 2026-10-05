// Module hooks for the unit tests: TypeScript and TSX through Vite's esbuild transform, and
// `virtual:responsive-images` resolved to the module a test generates in test/.generated/.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild } from 'vite';

export const GENERATED_VIRTUAL_MODULE = new URL('./.generated/virtual-responsive-images.mjs', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'virtual:responsive-images') {
    return { url: GENERATED_VIRTUAL_MODULE.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (!/\.tsx?$/.test(new URL(url).pathname)) return nextLoad(url, context);
  const file = fileURLToPath(url);
  const { code } = await transformWithEsbuild(await readFile(file, 'utf8'), file, {
    format: 'esm',
    jsx: 'automatic',
    target: 'node20',
  });
  return { format: 'module', source: code, shortCircuit: true };
}
