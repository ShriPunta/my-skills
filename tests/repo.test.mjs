import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const plugin = JSON.parse(read('.claude-plugin/plugin.json'));
const readme = read('README.md');

for (const dir of plugin.skills) {
  const name = basename(dir);
  const bucket = basename(dirname(dir));

  test(`${name}: SKILL.md, README entry, docs page, evals`, () => {
    const skill = read(join(dir, 'SKILL.md'));
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\n`), 'frontmatter name matches folder');
    assert.match(skill, /\ndescription: .+\n/);
    assert.ok(skill.split('\n').length <= 45, 'SKILL.md at most 45 lines');

    const docs = `docs/${bucket}/${name}.md`;
    assert.ok(existsSync(join(ROOT, docs)), `${docs} exists`);
    for (const h of ['## What it does', '## When to reach for it', '## Common questions', "## It's working if"]) {
      assert.ok(read(docs).includes(h), `${docs} has "${h}"`);
    }
    assert.ok(readme.includes(`](${dir.slice(2)}/SKILL.md)`), 'README links SKILL.md');
    assert.ok(readme.includes(`](${docs})`), 'README links docs page');

    const evals = JSON.parse(read(join(dir, 'evals/evals.json')));
    assert.equal(evals.skill_name, name);
    assert.ok(evals.evals.length >= 2, 'at least two evals');
    for (const e of evals.evals) assert.ok(e.prompt && e.expected_output, `eval ${e.id} has prompt and expected_output`);
  });

  test(`${name}: agents/openai.yaml matches invocation`, () => {
    const yamlPath = join(dir, 'agents/openai.yaml');
    assert.ok(existsSync(join(ROOT, yamlPath)), `${yamlPath} exists`);
    const yaml = read(yamlPath);
    assert.match(yaml, /^interface:\n/m);
    assert.match(yaml, /\n  display_name: .+\n/);
    assert.match(yaml, /\n  short_description: .+/);
    const userInvoked = /\ndisable-model-invocation: true\n/.test(read(join(dir, 'SKILL.md')).split('\n---')[0] + '\n');
    const noImplicit = /\n  allow_implicit_invocation: false\b/.test(yaml);
    assert.equal(noImplicit, userInvoked, 'allow_implicit_invocation: false iff disable-model-invocation: true');
  });

  test(`${name}: relative links in SKILL.md resolve`, () => {
    const skill = read(join(dir, 'SKILL.md'));
    for (const [, target] of skill.matchAll(/\]\(([^)#\s]+)\)/g)) {
      if (/^[a-z]+:/.test(target)) continue;
      assert.ok(existsSync(join(ROOT, dir, target)), `${name}/SKILL.md links ${target}`);
    }
  });
}

test('reference files are linked from their SKILL.md', () => {
  const links = {
    'skills/engineering/repo-overview': ['SCHEMA.md', 'INTERVIEW.md'],
    'skills/engineering/setup-repo-overview': ['PRESETS.md', 'HOOKS.md'],
  };
  for (const [dir, files] of Object.entries(links)) {
    const skill = read(join(dir, 'SKILL.md'));
    for (const f of files) assert.ok(skill.includes(`](${f})`), `${dir}/SKILL.md links ${f}`);
  }
});

test('templates use TODO(fill: NAME) markers, never {{ placeholders', () => {
  const bad = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (readFileSync(p, 'utf8').includes('{{')) bad.push(relative(ROOT, p));
    }
  };
  walk(join(ROOT, 'skills/engineering/repo-overview/templates'));
  assert.deepEqual(bad, []);
  for (const f of ['00-summary.md', '01-intent.md', 'items/_item.md']) {
    assert.ok(existsSync(join(ROOT, 'skills/engineering/repo-overview/templates', f)), `template ${f} exists`);
  }
});

test('every skill folder is listed in plugin.json', () => {
  const listed = new Set(plugin.skills.map((s) => s.slice(2)));
  for (const bucket of readdirSync(join(ROOT, 'skills')).filter((b) => statSync(join(ROOT, 'skills', b)).isDirectory())) {
    for (const name of readdirSync(join(ROOT, 'skills', bucket))) {
      assert.ok(listed.has(`skills/${bucket}/${name}`), `skills/${bucket}/${name} in plugin.json`);
    }
  }
});

test('no em-dashes or email addresses in text files', () => {
  const bad = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      if (e === '.git' || e === 'node_modules') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(md|json|mjs|js|ya?ml)$/.test(e)) continue;
      const text = readFileSync(p, 'utf8');
      if (text.includes(String.fromCharCode(0x2014))) bad.push(`${relative(ROOT, p)}: em-dash`);
      if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text.replace(/@[\w-]+\/[\w-]+/g, ''))) bad.push(`${relative(ROOT, p)}: email`);
    }
  };
  walk(ROOT);
  assert.deepEqual(bad, []);
});
