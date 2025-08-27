import { describe, test, expect, mock, spyOn } from "bun:test";
import shellFunction from "../src/tasks/shell.js";

// Mock console.log to reduce noise
const mockConsoleLog = mock(() => {});

describe("Shell Runtime Compatibility", () => {
  test("detects Bun runtime correctly", () => {
    // Since we're running in Bun, Bun should be defined
    expect(typeof Bun).toBe("object");
    expect(Bun.$).toBeDefined();
  });

  test("shell with Bun runtime (integration)", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "bun shell test output"`;

    expect(result.status).toBe("success");
    expect(result.output).toContain("bun shell test output");

    console.log.mockRestore();
  }, 3000);

  test("shell handles multiline scripts", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`
      echo "line 1"
      echo "line 2"
      echo "line 3"
    `;

    expect(result.status).toBe("success");
    expect(result.output).toContain("line 1");
    expect(result.output).toContain("line 2");
    expect(result.output).toContain("line 3");

    console.log.mockRestore();
  }, 3000);

  test("shell handles shell commands with pipes", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "hello world" | wc -w`;

    expect(result.status).toBe("success");
    expect(result.output.trim()).toBe("2");

    console.log.mockRestore();
  }, 3000);

  test("shell handles commands with environment variables", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo $TEST_VAR`.env({
      TEST_VAR: "test_value",
    });

    expect(result.status).toBe("success");
    expect(result.output).toContain("test_value");

    console.log.mockRestore();
  }, 3000);

  test("shell handles working directory change", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`pwd`.cwd("/tmp");

    expect(result.status).toBe("success");
    expect(result.output).toContain("/tmp");

    console.log.mockRestore();
  }, 3000);

  test("shell handles stderr output", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`
      echo "error message" >&2
      exit 1
    `;

    expect(result.status).toBe("fail");
    expect(result.output).toContain("error message");

    console.log.mockRestore();
  }, 3000);

  test("shell handles complex multiline scripts", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`
      #!/bin/bash
      NAME="world"
      echo "Hello $NAME!"
      if [ -d "/tmp" ]; then
        echo "tmp directory exists"
      fi
      ls -la / | head -5
    `;

    expect(result.status).toBe("success");
    expect(result.output).toContain("Hello world!");
    expect(result.output).toContain("tmp directory exists");
    expect(result.output).toContain("total");

    console.log.mockRestore();
  }, 5000);

  test("shell function exists and has correct structure", () => {
    const shellCode = shellFunction.toString();
    expect(shellCode).toContain('import("bun")');
    expect(shellCode).toContain("!isBun");
    expect(shellCode).toContain("exec");
  });

  test("shell handles special characters in scripts", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`
      echo "hello world" && echo "second line" || echo "fallback"
      echo 'single quotes work'
      echo "double quotes work"
      mkdir -p /tmp/test_dir && echo "directory created" && rm -rf /tmp/test_dir
    `;

    expect(result.status).toBe("success");
    expect(result.output).toContain("hello world");
    expect(result.output).toContain("second line");
    expect(result.output).toContain("single quotes work");
    expect(result.output).toContain("double quotes work");
    expect(result.output).toContain("directory created");

    console.log.mockRestore();
  }, 3000);
});
