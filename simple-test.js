import { $ } from "bun";

// Test Bun Shell directly
async function testBunShell() {
  try {
    console.log("Testing Bun Shell directly...");
    const result = await $`echo "hello world"`;
    console.log("Direct Bun Shell result:", result);
  } catch (error) {
    console.error("Direct Bun Shell error:", error);
  }
}

testBunShell();
