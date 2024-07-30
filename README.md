# 🍲 bunosh

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients such as mushrooms, cheese, sour cream*

<p align="center">
  <img src="assets/logo.jpg" alt="Logo">
</p>

## What it is?

Bunosh is a task runner powered by [Bun](https://bun.sh). Bunosh is aimed to help you to write common scripts in JavaScript with less effort. Combines awesome tools: Bun, Commander.js, Ink, Inquirer in a the most compact way.

What can you automate with Bunosh:

* shell scripts → use JavaScript to write them (you know it better, anyway!)
* boilerplate scripts → create new files from templates
* deploy scripts → combine JS and Shell commands to build and deploy
* parallel tasks → with native `Promise.all` execute multiple tasks at once
* ...every other task you have previously written a custom `js` or `shell` script

Bunosh will get your scripts cooked into a **single JavaScript file**.

Each function of this file:
```js
/** Cleans up tmp & logs dir **/
export async function cleanTmp() {
  await $`rm -rf tmp/*`;
  await $`rm -rf logs/*`;
}

/** Builds Docker images for project **/
export async function build(opts = { push: false }) {
  await Promise.all([
    buildFrontend(),
    buildBackend(),
  ])

  if (opts.push) {
    await $`docker push frontend`;
    await $`docker push backend`;
  }
}

/** Deploys application **/
export async function deploy(env = 'staging') {
  await build();
  // ...
}

/** Adds value to config **/
export async function addToConfig(key, value) {}

//....
```

Is turned into an executable command:
```
Commands:
  add:to-config  Adds value to config
    bunosh add:to-config [key] [value]
  build          Builds Docker images for project
    bunosh build --push
  clean:tmp      Cleans up tmp & logs dir
  deploy         Deploys application
    bunosh deploy [env=staging]


Special Commands:
  📝 Edit bunosh file: bunosh edit
  📥 Export scripts to package.json: bunosh export:scripts

```

### Command Rules:

* each exported function is a command: 
  * `function addUserModel` → `bunosh add:user-model`
* each function argument is a command argument:
  * `addUser(name)`  → `bunosh add:user <name>`
  * `addUser(name='john')` → `bunosh add:user [name=john]`
* last argument passed as an object defines options:
  * `clean(opts = {tmp: false, logs: false})` → `bunosh clean --tmp --logs`
  * `addUsers(opts = {num: 1})` → `bunosh add:users --num 1`
* docblock or first-line comment of a function makes a command description
* functions can call make fetch requests, exec shell commands or call other functions


### Installation

Install [Bun](https://bun.sh) (faster NodeJS alternative)

Install Bunosh globally:

```bash
bun install -g bunosh 
```

Create a new tasks file in a project directory:

```bash
bunosh init
```

### API

Commands can be written using classical NodeJS API using `fs` or `child_process` modules and print output using `console.log`. However, this doesn't unleash true Bunosh power.

Bunosh ships with a built-in functions to simplify writing scripts:

### Exec 

`exec` or `$` is a wrapper around [Bun Shell](https://bun.sh/docs/runtime/shell). It is cross-platform bash-like shell with seamless JavaScript interop.

```js
import { exec } from `bunosh`

export async function build()
{
  await exec`docker ps`
  await exec`docker build -t api .`
}
```

Bunosh wraps `$` to make a fancy realtime output with Ink:

