/**
 * Resolves the multi-file OpenAPI spec in docs/ into a single
 * docs/openapi.bundled.yaml that Swagger UI can serve directly.
 *
 * Written by hand rather than pulling in a bundler CLI so that the Vercel
 * build has no extra network dependency and always produces the same output.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const docsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs');
const cache = new Map();

const load = (file) => {
  if (!cache.has(file)) cache.set(file, yaml.load(fs.readFileSync(file, 'utf8')));
  return cache.get(file);
};

const unescape = (token) => token.replace(/~1/g, '/').replace(/~0/g, '~');

const pointer = (doc, ptr) =>
  ptr
    .split('/')
    .filter(Boolean)
    .reduce((node, token) => {
      const key = unescape(token);
      if (node == null || !(key in node)) throw new Error(`Pointer ${ptr} not found`);
      return node[key];
    }, doc);

/** Recursively inlines every external $ref. Internal #/components refs are left alone. */
const resolve = (node, baseDir) => {
  if (Array.isArray(node)) return node.map((entry) => resolve(entry, baseDir));
  if (node === null || typeof node !== 'object') return node;

  if (typeof node.$ref === 'string' && !node.$ref.startsWith('#')) {
    const [filePart, ptr = ''] = node.$ref.split('#');
    const target = path.resolve(baseDir, filePart);
    const resolved = ptr ? pointer(load(target), ptr) : load(target);
    const inlined = resolve(resolved, path.dirname(target));

    const siblings = { ...node };
    delete siblings.$ref;
    return Object.keys(siblings).length ? { ...inlined, ...resolve(siblings, baseDir) } : inlined;
  }

  return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, resolve(value, baseDir)]));
};

const spec = resolve(load(path.join(docsDir, 'openapi.yaml')), docsDir);
const outFile = path.join(docsDir, 'openapi.bundled.yaml');
fs.writeFileSync(outFile, yaml.dump(spec, { lineWidth: 120, noRefs: true }));

const pathCount = Object.keys(spec.paths ?? {}).length;
const opCount = Object.values(spec.paths ?? {}).reduce(
  (sum, item) => sum + Object.keys(item).filter((k) => ['get', 'post', 'patch', 'put', 'delete'].includes(k)).length,
  0,
);
console.log(`Bundled ${pathCount} paths / ${opCount} operations -> docs/openapi.bundled.yaml`);
