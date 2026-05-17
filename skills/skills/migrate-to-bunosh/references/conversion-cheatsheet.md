# Conversion Cheatsheet

Line-by-line equivalents for porting scripts into a `Bunoshfile.js`.

**Guiding principle:** these mappings are for *rewriting into idiomatic JS*, not
wrapping. Express control flow and data handling in JavaScript; use
`` shell`...` `` only to invoke external tools (`git`, `docker`, `npm`,
`kubectl`, `rsync`, compilers). When a row says "keep in shell", that means the
literal external command — not its surrounding logic. Aim for a result that's
shorter and clearer than the original.

Read the relevant section, then translate. Sections:

1. [package.json scripts](#1-packagejson-scripts)
2. [Bash / shell](#2-bash--shell)
3. [Makefile / Justfile](#3-makefile--justfile)
4. [Node.js scripts](#4-nodejs-scripts)
5. [Argument & flag parsing](#5-argument--flag-parsing)
6. [Error / exit behaviour](#6-error--exit-behaviour)
7. [Common mistakes](#7-common-mistakes)

---

## 1. package.json scripts

First filter (see SKILL.md "What NOT to migrate"): leave trivial one-tool
entries in `package.json`; migrate only composed scripts and ones that run a
script file. Only the migrated entries become exported functions; pre/post
hooks and chaining become explicit calls.

```json
{ "scripts": {
  "dev": "next dev",                       ← keep (one tool, no logic)
  "lint": "eslint .",                      ← keep
  "test": "playwright test",               ← keep
  "prebuild": "rm -rf dist",               ← migrate (folds into build)
  "build": "node scripts/build.mjs --prod",← migrate (script file)
  "ci": "npm run lint && npm run build && npm test"  ← migrate (composition)
}}
```

```js
export async function build() {
  await shell`rm -rf dist`;              // former prebuild, inlined
  await shell`node scripts/build.mjs --prod`;
}

export async function ci() {
  task.stopOnFailures();                 // && means abort on failure
  await shell`npm run lint`;             // kept one-liners called as-is
  await build();
  await shell`npm test`;
}
```

Note `ci` calls the kept `lint`/`test` via `npm run` rather than reimplementing
`eslint`/`playwright` — the trivial entries stay authoritative.

- `npm-run-all` / `concurrently` parallel scripts → `Promise.all([...])`.
- `cross-env FOO=bar cmd` → `` shell`cmd`.env({ FOO: 'bar' }) ``.
- `&&` chains → sequential `await` + `task.stopOnFailures()`.
- `;` chains → sequential `await` without stopOnFailures.
- A script that just calls another script → call the exported function directly.
- After migrating, run `bunosh export:scripts` to rewrite the `scripts` block as
  `"<cmd>": "bunosh <cmd>"` so `npm run <cmd>` still works (see SKILL.md step 6).

## 2. Bash / shell

| Bash | Bunosh |
|------|--------|
| `echo "msg"` | `say('msg')` |
| `echo "msg" >&2` / errors | `yell('msg')` |
| `cmd1 && cmd2` | `await shell\`cmd1\`; ` then check / `task.stopOnFailures()` |
| `cmd1; cmd2` | two `await shell` calls |
| `VAR=val cmd` | `` shell`cmd`.env({ VAR: 'val' }) `` |
| `cd dir && cmd` | `` shell`cmd`.cwd('dir') `` |
| `export VAR=val` (script-wide) | `.env({ VAR: 'val' })` on each shell call, or set once and reuse |
| `$VApiAR` interpolation | JS template `${variable}` inside `` shell`...` `` |
| `$(cmd)` command substitution | `const r = await shell\`cmd\`; r.output.trim()` |
| `if [ -f file ]; then` | `if (await Bun.file('file').exists())` |
| `if [ -z "$x" ]; then` | `if (!x)` |
| `for f in *.js; do` | `for (const f of (await shell\`ls *.js\`).output.trim().split('\n'))` |
| `while read line; do` | iterate `result.output.split('\n')` or `result.lines` |
| `exit 1` | `return;` (Bunosh sets exit code) |
| `set -e` | `task.stopOnFailures();` at top of function |
| `$?` after a command | inspect `result.hasFailed` / `result.status` |
| `trap ... EXIT` cleanup | run cleanup in a `finally`, or a separate command |
| heredoc `cat <<EOF > f` | `writeToFile('f', line => { line\`...\`; })` |
| `cp a b` | `copyFile('a', 'b')` or `Bun.write('b', Bun.file('a'))` |
| `rm -rf x` | keep as `` await shell`rm -rf x` `` (fine to shell out) |
| `curl -s URL` | `await fetch('URL')` then `.json()` / `.text()` |
| `curl -X POST -d ... ` | `fetch(url, { method:'POST', headers, body })` |
| `jq '.field' file` | `const o = await Bun.file('file').json(); o.field` |
| `grep`, `sed`, `awk` pipelines | prefer JS on `result.output` (`.split`/`.filter`/`.replace`/`.map`); only keep a trivial one-shot filter in `` shell`...` `` |

Multiline shell is one template literal:

```js
await shell`
  npm ci
  npm run build
  npm test
`.env({ NODE_ENV: 'production' });
```

Argument parsing loops (`while [[ $# -gt 0 ]]; case $1 in --env) ...`) do **not**
get translated literally — delete them and use function parameters / an
`options` object instead (see §5).

## 3. Makefile / Justfile

Each target → exported function. The first word convention gives namespaces.

```makefile
.PHONY: build test deploy
build:
	go build -o bin/app
test: build
	go test ./...
deploy: test
	scp bin/app server:/srv/
```

```js
export async function build() {
  await shell`go build -o bin/app`;
}

export async function test() {
  task.stopOnFailures();
  await build();                 // prerequisite
  await shell`go test ./...`;
}

export async function deploy() {
  task.stopOnFailures();
  await test();                  // prerequisite chain
  await shell`scp bin/app server:/srv/`;
}
```

- Prerequisites (`test: build`) → call the prerequisite function first.
- Make variables (`$(BIN)`) → `const BIN = ...` or a parameter.
- `$@`, `$<` automatic vars → explicit strings.
- Make aborts on first failed recipe line → `task.stopOnFailures()`.
- Justfile recipes with parameters (`deploy env:`) → function parameters.

## 4. Node.js scripts

| Node.js | Bunosh |
|---------|--------|
| `require('child_process').exec/spawn` | `` await shell`...` `` |
| `console.log` | `say()` |
| `console.error` / `console.warn` | `yell()` / `say()` |
| `fs.readFile/promises` | `await Bun.file(p).text()` / `.json()` |
| `fs.writeFile` | `await Bun.write(p, data)` or `writeToFile()` |
| `fs.existsSync` / `fs.access` | `await Bun.file(p).exists()` |
| `fs.copyFile` | `copyFile(a, b)` |
| `process.env.X = ...` | `.env({ X: ... })` on the shell call |
| `process.chdir(d)` | `.cwd(d)` on the shell call |
| `process.exit(n)` | `return;` |
| `process.argv` parsing | function parameters + `options` (see §5) |
| `node-fetch` / `axios` | global `fetch` |
| top-level `main()` + arg parse + call | the exported function *is* the entry |
| `try { await x } catch (e) { exit }` | `const r = await x; if (r.hasFailed) return;` |

Callback / `.then()` chains collapse into linear `await`.

## 5. Argument & flag parsing

Throw away the parser; let Bunosh generate the CLI.

```bash
# bash: ./deploy.sh production --force --replicas 5
while [[ $# -gt 0 ]]; do case $1 in
  --force) FORCE=true; shift;;
  --replicas) REPLICAS="$2"; shift 2;;
  *) ENV="$1"; shift;;
esac; done
```

```js
/**
 * Deploy the app.
 * @param {string} env - target environment
 * @param {object} options
 * @param {boolean} [options.force=false]
 * @param {number}  [options.replicas=3]
 */
export async function deploy(env = 'staging', options = { force: false, replicas: 3 }) {
  const replicas = Number(options.replicas);   // CLI values arrive as strings
  // ...
}
```

→ `bunosh deploy production --force --replicas 5`

Rules:

- Positional args → leading parameters. No default = required.
- Flags → keys of the **last** parameter, an object literal.
- Boolean flag → default `false` (or `null`).
- Value flag → default of any non-false type; **coerce numbers** with `Number()`.
- `--dry-run` on the CLI → `options.dryRun` in code (camelCase).
- Required values the original `read`/prompted for → `await ask(...)`.

## 6. Error / exit behaviour

This is the most common porting bug. Decide per function which the original did:

| Original | Port |
|----------|------|
| `set -e`, `&&` chains, Make, most node scripts (abort on first error) | `task.stopOnFailures();` at the top |
| best-effort cleanup, `|| true`, `set +e` | `task.ignoreFailures();` or just don't check results |
| explicit `if [ $? -ne 0 ]; then exit` per step | `if (res.hasFailed) { yell('...'); return; }` |
| `cmd || fallback` | `const r = await shell\`cmd\`; if (r.hasFailed) await fallback();` |

Never use try/catch around `shell`/`fetch`/`task` expecting it to catch a failed
command — they resolve, not reject. Inspect `.hasFailed` / `.status` instead.
Never call `process.exit()`.

## 7. Common mistakes

- **Wrapping instead of rewriting.** Dumping a multi-line bash body into one
  `` shell`...` `` template "migrates" it but defeats the readability goal.
  Rewrite the logic in JS; shell out only for external tools.
- **Keeping the bash arg-parsing loop.** Delete it; use parameters/options.
- **`try/catch` around `shell`.** It won't catch command failure. Use result
  checks or `task.stopOnFailures()`.
- **`process.exit(1)` on error.** Use `return;`.
- **Forgetting `task.stopOnFailures()`** when porting `set -e` / `&&` / Make —
  the port will silently continue past failures and change behaviour.
- **Numeric options used as numbers.** CLI values are strings; `Number(x)`.
- **One Bunoshfile per script.** The whole point is *one* consolidated file
  (or one per namespace via `Bunoshfile.<ns>.js`).
- **Over-wrapping in `task()`.** Use `task()` to label a multi-step sequence,
  not every single `shell` call.
- **Function names that collide after kebab-casing.** `runTests` and `runTest`
  → `run:tests` / `run:test` is fine, but check the first-capital split doesn't
  merge two intents unexpectedly.
- **Adding code comments.** Bunosh style is JSDoc + clear names, no inline
  comments unless asked.
