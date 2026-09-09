// Run: node scripts/check-directory.mjs
// Compile the real client-safe helpers, then exercise them against the real snapshot.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const output = mkdtempSync(join(tmpdir(), 'tokengratis-directory-'));
try {
  const program = ts.createProgram(['filter', 'directory-state', 'constants'].map((name) => join(root, 'lib', `${name}.ts`)), {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    rootDir: join(root, 'lib'), outDir: output, strict: true, skipLibCheck: true, types: [], allowJs: true,
  });
  const errors = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  assert.equal(program.emit().emitSkipped, false);
  const require = createRequire(import.meta.url);
  const { readDirectoryState: read, writeDirectoryState: write, initialDirectoryState: initial, NEED_ORDER } = require(join(output, 'directory-state.js'));
  const { filterProviders, sortProviders } = require(join(output, 'filter.js'));
  const { DIRECTORY_PAGE_SIZE } = require(join(output, 'constants.js'));

  assert.deepEqual(read(''), initial());
  assert.deepEqual(read('?q=Gemini&m=text,vision,text,bogus&g=1&sort=models&page=3'), {
    search: 'Gemini', modalities: ['text', 'vision'], onlyFree: true, sort: 'models', page: 3,
  });
  assert.deepEqual(read('?m=bogus&g=true&sort=__proto__&page=Infinity'), initial());
  for (const page of ['-1', '0', '1.5', 'NaN', '9007199254740993']) assert.equal(read(`?page=${page}`).page, 1);
  for (const modality of NEED_ORDER) {
    const state = { search: 'llama / 3.3 & coding', modalities: [modality], onlyFree: true, sort: 'context', page: 4 };
    assert.deepEqual(read(write(state)), state);
  }
  assert.equal(write(initial()), '');
  const providers = JSON.parse(readFileSync(join(root, 'data/providers.json'), 'utf8'));
  const items = providers.map((p) => ({ ...p, searchText: `${p.name} ${p.models.map((m) => `${m.name} ${m.id}`).join(' ')}`.toLowerCase() }));
  assert.equal(filterProviders(items, initial()).length, items.length, 'Default must retain providers with no quota summary');
  const sample = providers.find((p) => p.models.length);
  for (const query of [sample.name, sample.models[0].id]) {
    assert.ok(filterProviders(items, { search: `  ${query.toUpperCase()}  `, modalities: [] }).some((p) => p.slug === sample.slug));
  }
  assert.equal(filterProviders(items, { search: '__no_such_provider_2026__', modalities: [] }).length, 0);
  const both = filterProviders(items, { search: '', modalities: ['text', 'vision'] });
  assert.ok(both.length > 0);
  assert.ok(both.every((p) => p.modalities.includes('text') && p.modalities.includes('vision')));
  const before = items.map((p) => p.slug);
  for (const sort of ['popular', 'name', 'models', 'context']) {
    const ordered = sortProviders(items, sort);
    assert.equal(ordered.length, items.length);
    assert.deepEqual(items.map((p) => p.slug), before, 'Sorting must not mutate the snapshot');
  }
  const pages = Math.ceil(items.length / DIRECTORY_PAGE_SIZE);
  const paginated = Array.from({ length: pages }, (_, i) => items.slice(i * DIRECTORY_PAGE_SIZE, (i + 1) * DIRECTORY_PAGE_SIZE)).flat();
  assert.deepEqual(paginated.map((p) => p.slug), before, 'Every provider remains reachable');
  console.log(`Directory checks passed: URL roundtrips, invalid params, real model search, AND filters, all sorts, ${items.length} providers across ${pages} pages.`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
