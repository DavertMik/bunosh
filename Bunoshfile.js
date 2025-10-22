#!/usr/bin/env bun
import { exec, shell, fetch, ai, task, ignoreFail, ask, say, yell, writeToFile } from "./index.js";


/**
 * Builds binary file for Bunosh
 */
export async function buildBinary() {
  await exec`bun build ./bunosh.js --compile --outfile bunosh`;
}

export async function buildDocker() {
  ignoreFail(true);
  // process.chdir('/home/davert/projects/testomatio/frontend')

  // await exec`yarn build`.cwd('/home/davert/projects/testomatio/frontend');
  await exec`docker build .`.cwd("/home/davert/projects/testomatio/frontend");
}

export async function helloWorld(name = 'person') {
  name = await ask("What's your name?", name);
  say(`👋 Hello, ${name}!`);
  const city = await ask('Which city do you live in?')
  const result = await fetch(`https://wttr.in/${city}?format=3`)
  say(`Weather in your city ${result.output}`)

  const toCleanup = await ask('Do you want me to cleanup tmp for you?', true);

  if (!toCleanup) {
    say('Bye, then!');
    return;
  }

  const tmpDir = require('os').tmpdir();
  await shell`rm -rf ${tmpDir}/*`;
  say('🧹 Cleaned up!');
}

/**
 * 🎉 Test
 * @param {*} arg1
 * @param {*} opts
 */
export async function testEverything(
  arg1,
  opts = { user: null, val: "ok", flag: false },
) {
  // console.log("Hello World!", arg1);
  yell("I need all git status");
  const pack = await task("read file package.json", () => {
    return fs.readFileSync("package.json").toString();
  });
  writeToFile("test.txt", (l) => {
    l`lock file`;
    l("Hello world");
    l.fromFile("package.json");
  });
  yell("done");
  yell("ok");
}

/**
 * Hello other
 */
export async function helloOther(
  opts = {
    user: null,
    val: "ok",
    flag: false,
  },
) {
  yell('run it')

  await fetch("https://reqres.in/api/users");

  await Promise.all([
    fetch("https://reqres.in/api/users/1"),
    exec`ps aux | grep redis`,
    fetch("https://reqres.in/api/users/2"),
  ]);

  // ignoreFail(true);

  await exec`ps aux | grep node`;
  // await exec`git status`.cwd('/home/davert/projects/codeceptjs');
}

/**
 * Hello other
 */
export async function helloTasks(num = 1) {
  yell('run it now please fast')

  const tasks = [];
    for (let i = 0; i < num; i++) {
      tasks.push(task(`Fetch user ${i + 1}`, async () => {
        const res = await fetch(`https://reqres.in/api/users/${i + 1}`);
        return res;
    }))
  }
  await Promise.all(tasks);
}

/**
 * Deploys code to staging
 */
export async function updateToProduction(env) {
  await Promise.all([
    exec`ps aux | grep redis`,
    exec`ps aux | grep clickhouse`,
    fetch("https://reqres.in/api/users/2"),
  ]);
}

/**
 * Deploys code to production
 */
export async function updateToStaging() {
  // this is not ok
  const env = await ask("Which environment we are in?");
  say(env);
}

/**
 * Test streaming output
 */
export async function testStreaming() {
  // Command that produces output over time
  await exec`sh -c 'for i in 1 2 3 4 5; do echo "Line $i"; sleep 0.5; done'`;
}

export async function aiSummary() {
  const res = await ai('Summarize this projet ' + fs.readFileSync('README.md').toString(), {
    summary: '1 line summary',
    keywords: 'popular keywords',
    motto: 'motivational post',
    alternatives: 'what are comparable alternatives',
    features: 'list of features uniq to this project'
  })
  console.log(res);
}

/**
 * Test live output validation
 */
export async function testLiveOutput() {
  console.log("Testing live output with no artifacts and no duplicates...\n");

  // Test with a command that produces clear, timed output
  await exec`sh -c 'echo "Step 1: Starting"; sleep 0.3; echo "Step 2: Processing"; sleep 0.3; echo "Step 3: Almost done"; sleep 0.3; echo "Step 4: Complete"'`;

  console.log("\n--- Test completed ---");
}

export async function testAsk() {

  const description = await ask('Enter project description:', {
    multiline: true
  });
}

/**
 * 🧪 Test exec().cwd() - Change working directory for command execution
 */
export async function testExecCwd() {
  say("🧁 Testing exec() with custom working directory");

  // Show current directory
  await exec`pwd`;

  // Run command in /tmp directory
  say("Running command in /tmp directory:");
  await exec`pwd`.cwd("/tmp");

  // Create a file in /tmp and verify it exists there
  await exec`echo "test from $(pwd)" > test-cwd.txt`.cwd("/tmp");
  await exec`cat test-cwd.txt`.cwd("/tmp");

  // List files in /tmp to show our file exists
  await exec`ls -la test-cwd.txt`.cwd("/tmp");

  // Cleanup
  await exec`rm -f test-cwd.txt`.cwd("/tmp");

  yell("✅ exec().cwd() test completed successfully!");
}

/**
 * 🧪 Test exec().env() - Set environment variables for command execution
 */
export async function testExecEnv() {
  say("🌍 Testing exec() with custom environment variables");

  // Test basic environment variable
  await exec`echo "TEST_VAR is: $TEST_VAR"`.env({ TEST_VAR: "Hello from Bunosh!" });

  // Test multiple environment variables
  await exec`echo "USER: $USER_VAR, ROLE: $ROLE_VAR"`.env({
    USER_VAR: "developer",
    ROLE_VAR: "tester"
  });

  // Test environment variable with spaces and special characters
  await exec`echo "Complex var: $COMPLEX_VAR"`.env({
    COMPLEX_VAR: "Hello world! This is a test with spaces & symbols."
  });

  // Test that environment variables don't persist between commands
  await exec`echo "After first command, TEST_VAR is: $TEST_VAR"`;

  // Test with a command that uses environment in different ways
  await exec`sh -c 'echo "Shell sees: $TEST_VAR and $ANOTHER_VAR"'`.env({
    TEST_VAR: "shell-value",
    ANOTHER_VAR: "another-value"
  });

  yell("✅ exec().env() test completed successfully!");
}

/**
 * 🧪 Test exec().cwd() and exec().env() together
 */
export async function testExecCombined() {
  say("🔗 Testing exec() with both cwd() and env() together");

  // Create a temporary directory structure
  await exec`mkdir -p /tmp/bunosh-test/subdir`.cwd("/tmp");

  // Run command with both custom cwd and env
  await exec`echo "In directory $(pwd), user is: $USER_VAR" > subdir/combined-test.txt`.cwd("/tmp/bunosh-test").env({
    USER_VAR: "combined-tester"
  });

  // Verify the file was created in the correct directory with correct content
  await exec`cat subdir/combined-test.txt`.cwd("/tmp/bunosh-test");

  // List the directory structure to confirm
  await exec`find . -name "*.txt" -exec echo "Found: {}" \;`.cwd("/tmp/bunosh-test");

  // Cleanup
  await exec`rm -rf /tmp/bunosh-test`.cwd("/tmp");

  yell("✅ exec().cwd() + exec().env() combined test completed!");
}

/**
 * 🐚 Test shell task with Bun shell commands
 */
export async function testShell() {
  say("🐚 Testing shell task - showcases Bun shell with fallback to exec");

  // Test basic Bun shell built-ins
  await shell`pwd`;
  await shell`echo "Hello from Bun Shell!"`;

  // File operations that work well with Bun shell
  await shell`echo "test content" > /tmp/bunosh-test.txt`;
  await shell`cat /tmp/bunosh-test.txt`;

  // Directory operations
  await shell`ls`;
  await shell`ls -la /tmp/bunosh-test.txt`;

  // Test with pipes (Bun shell supports basic piping)
  await shell`echo "Line 1\nLine 2\nLine 3" | head -2`;

  // Test working directory change
  await shell`pwd`.cwd("/tmp");

  // Test with environment variable
  await shell`echo "Hello $USER_VAR!"`.env({ USER_VAR: "Bunosh" });

  // More complex commands that may fallback to exec
  await shell`ps aux | grep node | head -3`;
  await shell`find /tmp -name "*bunosh*" -type f`;

  // Cleanup
  await shell`rm -f /tmp/bunosh-test.txt`;

  yell("✅ Shell test completed! (Uses Bun shell natively, falls back to exec when needed)");
}
