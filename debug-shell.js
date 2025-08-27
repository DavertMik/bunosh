import shell from "./src/tasks/shell.js";

// Test basic shell functionality
async function testBasic() {
  console.log("Testing basic shell functionality...");
  const result = await shell`/bin/echo "hello world"`;
  console.log("Shell task result:", result);
}

// Test environment variables
async function testEnv() {
  console.log("Testing environment variables...");
  const result = await shell`echo $TEST_VAR`.env({ TEST_VAR: "test_value" });
  console.log("Env result:", result);
}

// Test cwd
async function testCwd() {
  console.log("Testing cwd...");
  const result = await shell`pwd`.cwd("/tmp");
  console.log("Cwd result:", result);
}

// Run tests
testBasic()
  .then(() => testEnv())
  .then(() => testCwd())
  .catch(console.error);
