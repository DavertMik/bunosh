import { $ } from "bun";

// Test Bun Shell built-in commands
async function testBuiltins() {
  console.log("Testing Bun Shell built-in commands...");

  const commands = [
    'echo "hello"',
    "pwd",
    "ls",
    "cat /etc/hostname",
    "which ls",
  ];

  for (const cmd of commands) {
    try {
      console.log(`\nTesting: ${cmd}`);
      const result = await $`${cmd}`;
      console.log("Success:", result.stdout?.toString().trim() || "no output");
    } catch (error) {
      console.log("Error:", error.message);
    }
  }
}

testBuiltins();
