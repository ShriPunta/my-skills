import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync, copyFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseFrontmatter, buildIndex, loadDocs, validateDocs, countAuthorTodos, findReconfirm, indexFieldWarnings,
  resolveConfig, sameIndex, GENERATED_HEADER, HAND_HEADER,
} from '../skills/engineering/repo-overview/scripts/overview-index.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../skills/engineering/repo-overview/scripts/overview-index.mjs');

function tmp(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'overview-test-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
}
const runEnv = (cwd, env, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: '',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: '',
};
const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, env: GIT_ENV, encoding: 'utf8' });
const gitRepo = (dir) => { git(dir, 'init', '-q'); return dir; };
const commitAll = (dir, msg) => { git(dir, 'add', '-A'); git(dir, 'commit', '-qm', msg); };

const fm = (lines, body = '# Doc\n') => `---\n${lines.join('\n')}\n---\n${body}`;
const doc = (rel, data, text = '') => ({ rel, group: rel.includes('/') ? rel.split('/')[0] : '', slug: rel.includes('/') ? rel.slice(rel.indexOf('/') + 1).replace(/\.md$/, '') : rel.replace(/\.md$/, ''), text, data });
const intent = (dir) => ({ [`${dir}/01-intent.md`]: fm(['summary: Intent.']) });
const today = () => new Date().toISOString().slice(0, 10);

// --- parser ---------------------------------------------------------------

test('parses scalars, quotes, inline arrays, block lists, full-line comments', () => {
  const { data, body } = parseFrontmatter(fm([
    '# a comment',
    '  # indented comment',
    'name: Auth',
    'summary: "Sign-in: email and OAuth"',
    "area: 'core # not a comment'",
    'status: In progress # stays verbatim',
    'keywords: [login, "sso, saml", oauth]',
    'paths:',
    '  - src/auth/',
    '  - "lib/session.ts"',
    'nested:',
    '  inner: ignored',
  ], '# Auth\nbody'));
  assert.equal(data.name, 'Auth');
  assert.equal(data.summary, 'Sign-in: email and OAuth');
  assert.equal(data.area, 'core # not a comment');
  assert.equal(data.status, 'In progress # stays verbatim');
  assert.deepEqual(data.keywords, ['login', 'sso, saml', 'oauth']);
  assert.deepEqual(data.paths, ['src/auth/', 'lib/session.ts']);
  assert.deepEqual(data.nested, {});
  assert.equal(body, '# Auth\nbody');
});

test('regression: `#` inside a plain value is not a comment', () => {
  assert.equal(parseFrontmatter(fm(['summary: Fixes issue #12 for C#'])).data.summary, 'Fixes issue #12 for C#');
});

test('regression: block scalars fold or keep instead of indexing ">"', () => {
  const { data } = parseFrontmatter(fm([
    'summary: >',
    '  Folded line one',
    '  and line two.',
    'lit: |',
    '  a',
    '    b',
    'strip: >-',
    '  x',
    '  y',
    'keep: |-',
    '  p',
    '',
    '  q',
    'after: ok',
  ]));
  assert.equal(data.summary, 'Folded line one and line two.\n');
  assert.equal(data.lit, 'a\n  b\n');
  assert.equal(data.strip, 'x y');
  assert.equal(data.keep, 'p\n\nq');
  assert.equal(data.after, 'ok');
  const out = buildIndex([doc('00-summary.md', data)]);
  assert.match(out, /^- `00-summary\.md`: Folded line one and line two\.$/m);
});

test('quoted keys are accepted', () => {
  const { data } = parseFrontmatter(fm(['"summary": S.', "'odd key': v", '"esc\\"k": w']));
  assert.equal(data.summary, 'S.');
  assert.equal(data['odd key'], 'v');
  assert.equal(data['esc"k'], 'w');
});

test('nested map children never corrupt sibling lists', () => {
  const { data } = parseFrontmatter(fm([
    'meta:',
    '  owners:',
    '    - alice',
    '  deep:',
    '    - x',
    'paths:',
    '- src/',
    '- lib/',
    'related:',
    '  - name: a',
    '    note: b',
    '  - c',
    'summary: S.',
  ]));
  assert.deepEqual(data.meta, {});
  assert.deepEqual(data.paths, ['src/', 'lib/']);
  assert.deepEqual(data.related, ['name: a', 'c']);
  assert.equal(data.summary, 'S.');
});

test('CRLF and BOM are tolerated', () => {
  const { data } = parseFrontmatter('\uFEFF---\r\nsummary: S.\r\nkeywords:\r\n  - a\r\n---\r\nbody\r\n');
  assert.equal(data.summary, 'S.');
  assert.deepEqual(data.keywords, ['a']);
});

test('missing frontmatter or summary throws with file:line', () => {
  assert.throws(() => parseFrontmatter('# no fm\n', 'a.md'), /^Error: a\.md:1: missing frontmatter/);
  assert.throws(() => parseFrontmatter(fm(['name: x']), 'b.md'), /b\.md:1: missing required `summary`/);
  assert.throws(() => parseFrontmatter(fm(['name: x', 'summary:']), 'c.md'), /c\.md:3: missing required `summary`/);
  assert.throws(() => parseFrontmatter(fm(['- orphan', 'summary: s']), 'd.md'), /d\.md:2: list item without a key/);
});

test('regression: a summary that parses as a list says to quote it', () => {
  assert.throws(() => parseFrontmatter(fm(['name: x', 'summary: [beta] Adds SSO']), 'e.md'), /e\.md:3: summary parsed as a list; quote it/);
  assert.equal(parseFrontmatter(fm(['summary: "[beta] Adds SSO"'])).data.summary, '[beta] Adds SSO');
});

// --- index generation -----------------------------------------------------

const DOCS = [
  doc('features/zeta.md', { summary: 'Zeta.', area: 'api', status: 'Planned' }),
  doc('gaps/gaps.md', { summary: 'Gaps.' }),
  doc('01-intent.md', { summary: 'Intent.' }),
  doc('runbooks/deploy.md', { summary: 'Deploy.' }),
  doc('features/alpha.md', { summary: 'Alpha.', area: 'web', status: 'Implemented', keywords: ['a', 'b', 'c', 'd'] }),
  doc('00-summary.md', { summary: 'Summary.' }),
  doc('adr/one.md', { summary: 'ADR.' }),
];

test('index groups in order: core, configured, then alpha; entries sorted; path-independent header', () => {
  const config = { title: 'Acme Overview', groups: { features: { title: 'Features', indexFields: ['area', 'status'] }, gaps: { title: 'Known Gaps' } } };
  const out = buildIndex(DOCS, { config });
  const headings = out.split('\n').filter((l) => l.startsWith('#'));
  assert.deepEqual(headings, ['# Acme Overview', '## Core', '## Features', '## Known Gaps', '## Adr', '## Runbooks']);
  assert.ok(out.startsWith(`${GENERATED_HEADER}\n\n# Acme Overview\n\nRead this first`));
  assert.ok(!/node |--root/.test(out.split('\n')[0]), 'header names no path or command');
  assert.ok(out.indexOf('00-summary.md') < out.indexOf('01-intent.md'));
  assert.ok(out.indexOf('features/alpha.md') < out.indexOf('features/zeta.md'));
  assert.match(out, /^- `features\/alpha\.md`: `web` · `Implemented` · Alpha\. _\(a, b, c\)_$/m);
  assert.match(out, /^- `00-summary\.md`: Summary\.$/m);
  assert.ok(!out.includes(String.fromCharCode(0x2014)), 'no em-dashes');
  assert.ok(out.endsWith('\n') && !out.endsWith('\n\n'));
});

test('index is deterministic regardless of input order', () => {
  assert.equal(buildIndex(DOCS), buildIndex([...DOCS].reverse()));
});

test('sameIndex ignores the first line, CRLF, and trailing whitespace', () => {
  const a = buildIndex(DOCS);
  assert.ok(sameIndex(a.replace(GENERATED_HEADER, HAND_HEADER), a));
  assert.ok(sameIndex(a.replace(/\n/g, '\r\n'), a));
  assert.ok(sameIndex(a + '\n\n', a));
  assert.ok(!sameIndex(a.replace('Zeta.', 'Zed.'), a));
  assert.ok(!sameIndex(null, a));
});

// --- loading --------------------------------------------------------------

test('loadDocs skips _ files, INDEX.md, ignored README.md; slugs relative to group', (t) => {
  const root = tmp(t);
  write(root, {
    'INDEX.md': 'generated',
    'README.md': '# Overview folder readme, no frontmatter\n',
    'features/_template.md': '---\nname: x\n---\n',
    'features/a.md': fm(['summary: A.']),
    'features/team/b.md': fm(['summary: B.']),
    'bad.md': 'no frontmatter',
  });
  const { docs, errors } = loadDocs(root);
  assert.deepEqual(docs.map((d) => [d.rel, d.group, d.slug]), [['features/a.md', 'features', 'a'], ['features/team/b.md', 'features', 'team/b']]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^bad\.md:1:/);
  // Config `ignore` adds to the default README.md.
  const custom = loadDocs(root, { config: { ignore: ['bad.md', 'features/team/'] } });
  assert.deepEqual(custom.docs.map((d) => d.rel), ['features/a.md']);
  assert.deepEqual(custom.errors, []);
  assert.deepEqual(resolveConfig({ ignore: ['x.md', 'README.md'] }).ignore, ['README.md', 'x.md']);
});

test('regression: symlinks are safe (broken link reported, duplicates deduped by realpath)', (t) => {
  const root = tmp(t);
  write(root, { 'features/real.md': fm(['summary: Real.']) });
  symlinkSync(join(root, 'features/real.md'), join(root, 'features/alias.md'));
  symlinkSync(join(root, 'features'), join(root, 'mirror'));
  symlinkSync(join(root, 'missing.md'), join(root, 'gone.md'));
  symlinkSync(root, join(root, 'features/loop'));
  const { docs, errors } = loadDocs(root);
  assert.deepEqual(docs.map((d) => d.rel), ['features/real.md']);
  assert.deepEqual(errors, ['gone.md: broken symbolic link (target is missing)']);
});

// --- validation -----------------------------------------------------------

test('validation catches broken related, paths, related_docs, status, enums, fill markers', (t) => {
  const repo = tmp(t);
  write(repo, { 'src/auth/index.ts': '', 'docs/auth.md': '' });
  const config = { groups: { features: { statuses: ['Planned', 'Implemented'] } } };
  const docs = [
    doc('features/auth.md', { summary: 'A.', status: 'Implemented', related: ['billing'], paths: ['src/auth/', 'src/auth/**/*.ts'], related_docs: ['docs/auth.md', 'https://x.test/a'] }),
    doc('features/billing.md', { summary: 'B.', related: ['auth', 'features/auth', 'ghost'], paths: ['src/billing/'], status: 'Done', source: 'robot' }),
    doc('00-summary.md', { summary: 'S.', related_docs: ['docs/missing.md'], confirmed: '2024-13-45' }, 'Hi {{NOT_A_MARKER}} TODO(fill: PROJECT_NAME)'),
  ];
  const problems = validateDocs(docs, { repoRoot: repo, config, configText: '{"title": "TODO(fill: NAME) Overview"}' });
  assert.deepEqual(problems.sort(), [
    '00-summary.md: confirmed "2024-13-45" is not a YYYY-MM-DD date',
    '00-summary.md: related_docs "docs/missing.md" does not exist',
    '00-summary.md: unfilled TODO(fill: PROJECT_NAME)',
    'features/billing.md: paths "src/billing/" does not exist',
    'features/billing.md: related "ghost" does not match any item (use group/slug or a unique slug)',
    'features/billing.md: source "robot" is not one of: author, derived, mixed',
    'features/billing.md: status "Done" is not one of: Planned, Implemented',
    'overview.config.json: unfilled TODO(fill: NAME)',
  ]);
});

test('regression: renamed group with its own statuses; undeclared groups are not status-checked', () => {
  const docs = [doc('experiments/e1.md', { summary: 'E.', status: 'Running' }), doc('notes/n.md', { summary: 'N.', status: 'Whatever' })];
  assert.deepEqual(validateDocs(docs, {}), []);
  const config = { groups: { experiments: { statuses: ['Running', 'Concluded', 'Abandoned'] } } };
  assert.deepEqual(validateDocs(docs, { config }), []);
  assert.deepEqual(validateDocs([doc('experiments/e2.md', { summary: 'E.', status: 'Planned' })], { config }),
    ['experiments/e2.md: status "Planned" is not one of: Running, Concluded, Abandoned']);
});

test('required fields are enforced only for groups that declare them', () => {
  const config = { groups: { features: { required: ['name', 'status', 'paths'] } } };
  const docs = [doc('features/a.md', { summary: 'A.', name: 'A', paths: [] }), doc('api/b.md', { summary: 'B.' })];
  assert.deepEqual(validateDocs(docs, { config }), [
    'features/a.md: missing required field `status` (group features)',
    'features/a.md: missing required field `paths` (group features)',
  ]);
});

test('regression: related resolves across all item groups; nested slugs do not collide; ambiguity is reported', () => {
  const docs = [
    doc('features/a/auth.md', { summary: 'A.' }),
    doc('features/b/auth.md', { summary: 'B.' }),
    doc('api/login.md', { summary: 'L.' }),
    doc('services/login.md', { summary: 'L2.' }),
    doc('jobs/sync.md', { summary: 'J.', related: ['a/auth', 'features/b/auth.md', 'api/login', 'auth', 'login'] }),
  ];
  assert.deepEqual(validateDocs(docs, {}), [
    'jobs/sync.md: related "auth" does not match any item (use group/slug or a unique slug)',
    'jobs/sync.md: related "login" is ambiguous (api/login, services/login); use group/slug',
  ]);
  assert.deepEqual(validateDocs([doc('00-summary.md', { summary: 'S.', related: ['sync'] }), doc('jobs/sync.md', { summary: 'J.' })], {}), []);
});

test('secret patterns and denyPatterns are reported by label and line, never echoing the value', () => {
  const aws = 'AKIA' + 'ABCDEFGHIJKLMNOP';
  const gh = 'ghp_' + 'a'.repeat(36);
  const pem = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
  const docs = [doc('03-operations.md', { summary: 'O.' }, `line1\nkey ${aws}\ntoken ${gh}\n${pem}\nhost db.internal.example.com\n`)];
  const problems = validateDocs(docs, { config: { denyPatterns: ['internal\\.example\\.com'] } });
  assert.deepEqual(problems, [
    '03-operations.md:2: possible secret (AWS access key id)',
    '03-operations.md:3: possible secret (GitHub token)',
    '03-operations.md:4: possible secret (private key)',
    '03-operations.md:5: matches denyPatterns "internal\\.example\\.com"',
  ]);
  assert.ok(!problems.join('\n').includes(aws));
  assert.throws(() => resolveConfig({ denyPatterns: ['('] }), /invalid denyPatterns entry/);
});

test('TODO(author) markers are counted, not validation problems', () => {
  const docs = [doc('01-intent.md', { summary: 'I.' }, 'TODO(author): why?\nTODO(author): who for?'), doc('00-summary.md', { summary: 'S.' }, 'TODO(author): status?')];
  assert.deepEqual(validateDocs(docs, {}), []);
  assert.deepEqual(countAuthorTodos(docs), [{ rel: '01-intent.md', count: 2 }, { rel: '00-summary.md', count: 1 }]);
});

test('regression: markers inside HTML comments are not counted', () => {
  const text = '<!-- Replace TODO(fill: NAME) markers; write TODO(author): <q> when unsure.\n   TODO(author) spans lines -->\nReal TODO(author): why?\n';
  const docs = [doc('01-intent.md', { summary: 'I.' }, text)];
  assert.deepEqual(validateDocs(docs, {}), []);
  assert.deepEqual(countAuthorTodos(docs), [{ rel: '01-intent.md', count: 1 }]);
  assert.deepEqual(validateDocs([doc('a.md', { summary: 'A.' }, '<!-- c -->TODO(fill: X)')], {}), ['a.md: unfilled TODO(fill: X)']);
});

test('regression: indexFields values that parse as maps are warned about', () => {
  const { data } = parseFrontmatter(fm(['summary: A.', 'area:', '  web: true', 'status: [Beta, GA]']));
  const config = { groups: { features: { indexFields: ['area', 'status'] } } };
  assert.deepEqual(indexFieldWarnings([doc('features/a.md', data)], { config }),
    ['features/a.md: indexFields value `area` parsed as a map; use a scalar or a list']);
  assert.deepEqual(indexFieldWarnings([doc('features/b.md', { summary: 'B.', area: 'web' })], { config }), []);
});

test('regression: findReconfirm lists old `confirmed`, and unconfirmed author docs with no open TODO(author)', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');
  const docs = [
    doc('01-intent.md', { summary: 'I.', source: 'author', confirmed: '2025-01-01' }),
    doc('00-summary.md', { summary: 'S.', source: 'mixed', confirmed: '2026-05-01' }),
    doc('02-stack.md', { summary: 'St.', source: 'derived', confirmed: '2000-01-01' }),
    doc('03-context.md', { summary: 'C.', source: 'mixed' }),
    doc('04-goals.md', { summary: 'G.', source: 'author' }, 'TODO(author): which goals?'),
    doc('05-notes.md', { summary: 'N.', source: 'author' }, '<!-- TODO(author) is how to ask -->'),
    doc('roadmap.md', { summary: 'R.', source: 'author' }),
  ];
  assert.deepEqual(findReconfirm(docs, { days: 180, now }), [
    { doc: '01-intent.md', confirmed: '2025-01-01', ageDays: 516 },
    { doc: '05-notes.md', confirmed: null, ageDays: null },
    { doc: 'roadmap.md', confirmed: null, ageDays: null },
  ]);
  assert.deepEqual(findReconfirm(docs, { days: 0, now }), []);
});

// --- CLI: write and check ---------------------------------------------------

test('CLI writes INDEX.md, --check passes, then detects drift', (t) => {
  const repo = tmp(t);
  write(repo, {
    ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: What it is.']),
    'docs/overview/overview.config.json': JSON.stringify({ title: 'Demo Overview' }),
  });
  let r = run(repo);
  assert.equal(r.status, 0, r.stderr);
  const index = readFileSync(join(repo, 'docs/overview/INDEX.md'), 'utf8');
  assert.match(index, /# Demo Overview/);
  assert.equal(index.split('\n')[0], GENERATED_HEADER);

  r = run(repo, '--check');
  assert.equal(r.status, 0, r.stderr);

  write(repo, { 'docs/overview/features/new.md': fm(['summary: New feature.', 'status: Planned']) });
  r = run(repo, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /INDEX\.md is out of date\. Fix: node overview-index\.mjs --root docs\/overview\n/);
});

test('regression: --check fix hint is short and cwd-relative', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, { ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']), 'packages/a/src/x.js': '' });
  mkdirSync(join(repo, 'tools'));
  copyFileSync(SCRIPT, join(repo, 'tools/overview-index.mjs'));
  let r = spawnSync(process.execPath, ['tools/overview-index.mjs', '--check'], { cwd: repo, encoding: 'utf8' });
  assert.match(r.stderr, /Fix: node tools\/overview-index\.mjs --root docs\/overview\n/);
  r = spawnSync(process.execPath, [join(repo, 'tools/overview-index.mjs'), '--check', '--root', join(repo, 'docs/overview')], { cwd: join(repo, 'packages/a/src'), encoding: 'utf8' });
  assert.match(r.stderr, /Fix: node overview-index\.mjs --root docs\/overview\n/);
  assert.ok(!r.stderr.includes('../'), r.stderr);
});

test('CLI write mode warns; --check errors on broken links and fill markers; TODO(author) never fails', (t) => {
  const repo = tmp(t);
  write(repo, { ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']), 'docs/overview/features/a.md': fm(['summary: A.', 'related: [nope]'], 'TODO(fill: AREA)\nTODO(author): what is A for?\n{{literal}}\n') });
  let r = run(repo);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Warnings:[\s\S]*related "nope"/);
  assert.match(r.stderr, /unfilled TODO\(fill: AREA\)/);
  assert.match(r.stderr, /1 author-input items open/);
  r = run(repo, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Errors:[\s\S]*unfilled TODO\(fill: AREA\)/);

  write(repo, { 'docs/overview/features/a.md': fm(['summary: A.'], 'TODO(author): what is A for?\n{{literal}}\n') });
  run(repo);
  r = run(repo, '--check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /1 author-input items open \(TODO\(author\)\): features\/a\.md \(1\)/);

  write(repo, { 'docs/overview/b.md': fm(['name: b']) });
  r = run(repo);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /b\.md:\d+: missing required `summary`/);
});

test('regression: README.md without frontmatter in the root does not block the index', (t) => {
  const repo = tmp(t);
  write(repo, { ...intent('docs/overview'), 'docs/overview/README.md': '# About this folder\n', 'docs/overview/00-summary.md': fm(['summary: S.']) });
  assert.equal(run(repo).status, 0);
  assert.equal(run(repo, '--check').status, 0);
});

test('regression: CRLF and hand-maintained INDEX pass --check', (t) => {
  const repo = tmp(t);
  write(repo, { ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']) });
  run(repo);
  const p = join(repo, 'docs/overview/INDEX.md');
  const index = readFileSync(p, 'utf8');
  writeFileSync(p, index.replace(/\n/g, '\r\n'));
  assert.equal(run(repo, '--check').status, 0);
  writeFileSync(p, index.replace(GENERATED_HEADER, HAND_HEADER));
  assert.equal(run(repo, '--check').status, 0);
});

test('regression: running the script from a different path does not cause drift', (t) => {
  const repo = tmp(t);
  write(repo, { ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']) });
  mkdirSync(join(repo, 'tools'));
  const copy = join(repo, 'tools/overview-index.mjs');
  copyFileSync(SCRIPT, copy);
  assert.equal(run(repo).status, 0);
  const r = spawnSync(process.execPath, [copy, '--check'], { cwd: join(repo, 'docs'), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('regression: broken symlink gives a message, not a stack trace', (t) => {
  const repo = tmp(t);
  write(repo, { 'docs/overview/00-summary.md': fm(['summary: S.']) });
  symlinkSync(join(repo, 'nowhere.md'), join(repo, 'docs/overview/01-intent.md'));
  const r = run(repo);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /01-intent\.md: broken symbolic link/);
  assert.ok(!/\n\s+at /.test(r.stderr), r.stderr);
});

test('regression: oversized INDEX warns about indexBudgetBytes', (t) => {
  const repo = tmp(t);
  const files = { ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']), 'docs/overview/overview.config.json': JSON.stringify({ indexBudgetBytes: 2000 }) };
  for (let i = 0; i < 60; i++) files[`docs/overview/features/f${String(i).padStart(2, '0')}.md`] = fm([`summary: Feature number ${i} does a thing for users.`]);
  write(repo, files);
  let r = run(repo);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /over indexBudgetBytes \(2000\)/);
  assert.equal(run(repo, '--check').status, 0);
  write(repo, { 'docs/overview/overview.config.json': '{}' });
  r = run(repo);
  assert.ok(!r.stderr.includes('indexBudgetBytes'), r.stderr);
});

test('missing required core files warn in write mode and fail --check/--validate', (t) => {
  const repo = tmp(t);
  write(repo, { 'docs/overview/00-summary.md': fm(['summary: S.']) });
  let r = run(repo);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Warnings:[\s\S]*01-intent\.md: required core file is missing/);
  r = run(repo, '--check');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Errors:[\s\S]*01-intent\.md: required core file is missing/);
  assert.ok(!r.stderr.includes('00-summary.md: required'));
  assert.equal(run(repo, '--validate').status, 1);
  write(repo, intent('docs/overview'));
  run(repo);
  assert.equal(run(repo, '--check').status, 0);
});

// --- CLI: root resolution ---------------------------------------------------

test('CLI --root and config discovery; header does not depend on root', (t) => {
  const repo = tmp(t);
  write(repo, {
    'handbook/overview/overview.config.json': '{}',
    ...intent('handbook/overview'), 'handbook/overview/00-summary.md': fm(['summary: S.']),
  });
  const r = run(repo);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(repo, 'handbook/overview/INDEX.md'), 'utf8').split('\n')[0], GENERATED_HEADER);
  assert.equal(run(repo, '--root', 'handbook/overview', '--check').status, 0);
  assert.equal(run(join(repo, 'handbook/overview'), '--check').status, 0);
});

test('regression: monorepo resolves the nearest root walking up; ambiguity errors; --all runs every root', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, {
    ...intent('packages/a/docs/overview'), 'packages/a/docs/overview/00-summary.md': fm(['summary: A.']),
    ...intent('packages/b/docs/overview'), 'packages/b/docs/overview/00-summary.md': fm(['summary: B.']),
    'packages/b/src/index.js': '',
  });
  let r = run(join(repo, 'packages/b/src'));
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(repo, 'packages/b/docs/overview/INDEX.md')));
  assert.ok(!existsSync(join(repo, 'packages/a/docs/overview/INDEX.md')));

  r = run(repo);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Found 2 overview roots; pass --root DIR to pick one or --all/);
  assert.match(r.stderr, /packages\/a\/docs\/overview[\s\S]*packages\/b\/docs\/overview/);

  r = run(repo, '--all');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(repo, 'packages/a/docs/overview/INDEX.md')));
  assert.match(r.stdout, /\[packages\/a\/docs\/overview\][\s\S]*\[packages\/b\/docs\/overview\]/);
  assert.equal(run(repo, '--all', '--check').status, 0);
  assert.equal(run(repo, '--all', '--root', 'x').status, 2);

  // A root-level overview is nearest and wins over package overviews.
  write(repo, { 'docs/overview/00-summary.md': fm(['summary: Root.']) });
  assert.equal(run(join(repo, 'packages')).status, 0);
  assert.ok(existsSync(join(repo, 'docs/overview/INDEX.md')));
});

test('dotted roots (.overview, .config/overview) are found walking up and searching down', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, { '.overview/00-summary.md': fm(['summary: S.']), 'src/x.js': '' });
  assert.equal(run(join(repo, 'src')).status, 0);
  assert.ok(existsSync(join(repo, '.overview/INDEX.md')));
  const repo2 = gitRepo(tmp(t));
  write(repo2, { 'tools/cli/.config/overview/00-summary.md': fm(['summary: S.']) });
  assert.equal(run(repo2).status, 0);
  assert.ok(existsSync(join(repo2, 'tools/cli/.config/overview/INDEX.md')));
});

test('regression: no git and cwd is $HOME: no down-search, asks for --root', (t) => {
  const home = tmp(t);
  write(home, { 'projects/x/docs/overview/00-summary.md': fm(['summary: S.']) });
  const env = { HOME: home, GIT_CEILING_DIRECTORIES: dirname(home) };
  let r = runEnv(home, env);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /home folder; refusing to search it\. Pass --root DIR/);
  assert.ok(!existsSync(join(home, 'projects/x/docs/overview/INDEX.md')));
  assert.equal(runEnv(home, env, '--all').status, 2);
  // Walking up still finds a dotfiles overview at $HOME.
  write(home, { '.config/overview/00-summary.md': fm(['summary: Dotfiles.']) });
  r = runEnv(home, env);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(home, '.config/overview/INDEX.md')));
});

test('config accepts preset, modifiers, sections and unknown keys', (t) => {
  const repo = tmp(t);
  write(repo, {
    'docs/overview/overview.config.json': JSON.stringify({ preset: 'app', modifiers: ['oss'], sections: ['02-stack'], futureKey: 1 }),
    ...intent('docs/overview'), 'docs/overview/00-summary.md': fm(['summary: S.']),
    'docs/overview/features/_template.md': fm(['summary: TODO(fill: SUMMARY)']),
  });
  const r = run(repo, '--validate');
  assert.equal(r.status, 0, r.stderr);
});

// --- CLI: staleness ---------------------------------------------------------

test('CLI --stale reports code changed after the doc', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, {
    'src/auth/login.ts': 'v1',
    'src/other.ts': 'v1',
    'docs/overview/features/auth.md': fm(['summary: Auth.', 'paths:', '  - src/auth/']),
  });
  commitAll(repo, 'initial');

  let r = run(repo, '--stale', '--strict');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /No stale overview files/);

  write(repo, { 'src/other.ts': 'v2' });
  git(repo, 'commit', '-qam', 'unrelated change');
  assert.match(run(repo, '--stale').stdout, /No stale overview files/);

  write(repo, { 'src/auth/login.ts': 'v2' });
  git(repo, 'commit', '-qam', 'change login flow');
  r = run(repo, '--stale');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /features\/auth\.md: 1 commit\(s\), newest [0-9a-f]+ "change login flow"/);
  assert.equal(run(repo, '--stale', '--strict').status, 1);

  write(repo, { 'src/auth/login.ts': 'v3' });
  assert.match(run(repo, '--stale').stdout, /1 uncommitted file\(s\)/);

  write(repo, { 'docs/overview/features/auth.md': fm(['summary: Auth, updated.', 'paths:', '  - src/auth/']) });
  git(repo, 'commit', '-qam', 'update overview');
  assert.match(run(repo, '--stale').stdout, /No stale overview files/);
});

test('regression: --stale excludes the overview root and lockfiles', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, {
    'docs/guide.md': 'v1',
    'app/index.js': 'v1',
    'app/package-lock.json': '{}',
    'docs/overview/02-docs.md': fm(['summary: Docs.', 'paths: [docs/]']),
    'docs/overview/02-app.md': fm(['summary: App.', 'paths: [app/]']),
  });
  commitAll(repo, 'initial');
  run(repo);
  write(repo, { 'app/package-lock.json': '{"v":2}' });
  commitAll(repo, 'regen index, bump lockfile');
  let r = run(repo, '--stale', '--strict');
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /No stale overview files/);

  write(repo, { 'docs/guide.md': 'v2', 'app/index.js': 'v2' });
  commitAll(repo, 'real changes');
  r = run(repo, '--stale');
  assert.match(r.stdout, /02-app\.md: 1 commit/);
  assert.match(r.stdout, /02-docs\.md: 1 commit/);
});

test('--stale lists docs to reconfirm', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, {
    'src/a.js': 'v1',
    'docs/overview/01-intent.md': fm(['summary: Intent.', 'source: author', 'confirmed: 2000-01-01']),
    'docs/overview/00-summary.md': fm(['summary: S.', 'source: mixed', `confirmed: ${today()}`, 'paths: [src/]']),
    'docs/overview/02-context.md': fm(['summary: C.', 'source: mixed']),
  });
  commitAll(repo, 'initial');
  write(repo, { 'src/a.js': 'v2' });
  commitAll(repo, 'change a');

  const r = run(repo, '--stale');
  assert.match(r.stdout, /00-summary\.md: 1 commit\(s\), newest [0-9a-f]+ "change a"/);
  assert.match(r.stdout, /Needs reconfirm[\s\S]*01-intent\.md: confirmed 2000-01-01 \(\d+ days ago\)/);
  assert.ok(!/- 00-summary\.md: confirmed/.test(r.stdout));
  assert.ok(!r.stdout.includes('02-context.md'), r.stdout);
  assert.equal(run(repo, '--json').status, 2);
});

test('regression: --stale excludes every overview root, including nested package roots', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, {
    'packages/a/src/x.js': 'v1',
    'packages/a/docs/overview/00-summary.md': fm(['summary: A.']),
    'docs/overview/features/pkg-a.md': fm(['summary: Package a.', 'paths: [packages/a/]']),
  });
  commitAll(repo, 'initial');
  write(repo, { 'packages/a/docs/overview/00-summary.md': fm(['summary: A, edited.']) });
  commitAll(repo, 'edit package overview');
  let r = run(repo, '--stale', '--strict', '--root', 'docs/overview');
  assert.equal(r.status, 0, r.stdout);
  write(repo, { 'packages/a/src/x.js': 'v2' });
  commitAll(repo, 'code');
  r = run(repo, '--stale', '--root', 'docs/overview');
  assert.match(r.stdout, /pkg-a\.md: 1 commit\(s\), newest [0-9a-f]+ "code"/);
});

test('regression: --stale --base only counts branch commits and clears when the doc changed on the branch', (t) => {
  const repo = gitRepo(tmp(t));
  write(repo, { 'src/a.js': 'v1', 'src/b.js': 'v1', 'docs/overview/features/a.md': fm(['summary: A.', 'paths: [src/a.js]']) });
  commitAll(repo, 'initial');
  write(repo, { 'src/a.js': 'v2' });
  commitAll(repo, 'old drift on main');
  git(repo, 'branch', 'base');
  git(repo, 'checkout', '-qb', 'feature');

  // Default mode reports old drift; base mode ignores commits before the merge-base.
  assert.match(run(repo, '--stale').stdout, /a\.md: 1 commit/);
  let r = run(repo, '--stale', '--strict', '--base', 'base');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /No stale overview files/);

  write(repo, { 'src/b.js': 'v2' });
  commitAll(repo, 'unrelated');
  assert.match(run(repo, '--stale', '--base', 'base').stdout, /No stale overview files/);

  write(repo, { 'src/a.js': 'v3' });
  commitAll(repo, 'branch change');
  r = run(repo, '--stale', '--strict', '--base', 'base');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /changed since base with no doc update[\s\S]*features\/a\.md: 1 commit\(s\), newest [0-9a-f]+ "branch change"/);

  // Doc updated earlier on the branch than the code: still current in PR mode.
  write(repo, { 'docs/overview/features/a.md': fm(['summary: A, updated.', 'paths: [src/a.js]']) });
  commitAll(repo, 'doc');
  write(repo, { 'src/a.js': 'v4' });
  commitAll(repo, 'more code');
  assert.match(run(repo, '--stale', '--base', 'base').stdout, /No stale overview files/);

  // Uncommitted changes to paths are still reported (on a fresh branch).
  git(repo, 'checkout', '-qb', 'feature2', 'base');
  write(repo, { 'src/a.js': 'dirty' });
  assert.match(run(repo, '--stale', '--base', 'base').stdout, /a\.md: 1 uncommitted file\(s\)/);

  r = run(repo, '--stale', '--base', 'nope');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /base ref nope not found; fetch it \(CI: fetch-depth: 0\)/);
  assert.equal(run(repo, '--base', 'base').status, 2);
});

test('--stale warns in a shallow clone', (t) => {
  const base = tmp(t);
  const origin = join(base, 'origin');
  mkdirSync(origin);
  gitRepo(origin);
  write(origin, { 'src/a.js': 'v1', 'docs/overview/00-summary.md': fm(['summary: S.', 'paths: [src/]']) });
  commitAll(origin, 'one');
  write(origin, { 'src/a.js': 'v2' });
  commitAll(origin, 'two');
  git(base, 'clone', '-q', '--depth', '1', `file://${origin}`, 'clone');
  const r = run(join(base, 'clone'), '--stale');
  assert.match(r.stderr, /shallow clone/);
});

test('CLI --stale outside git reports gracefully', (t) => {
  const repo = tmp(t);
  write(repo, { 'docs/overview/a.md': fm(['summary: A.', 'paths: [x]']) });
  const r = run(repo, '--stale');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Not a git repository/);
});
