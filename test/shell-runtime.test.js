import { describe, test, expect, mock, spyOn } from "bun:test";
import shellFunction from "../src/tasks/shell.js";
import { $ } from "bun";

// Mock console.log to reduce noise
const mockConsoleLog = mock(() => {});

describe("Shell Task with Bun Shell $ API", () => {
  test("detects Bun runtime and shell API correctly", () => {
    // Since we're running in Bun, Bun should be defined
    expect(typeof Bun).toBe("object");
    expect($).toBeDefined();
  });

  test("shell basic command execution", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "bun shell test output"`;

    expect(result.status).toBe("success");
    expect(result.output).toContain("bun shell test output");

    console.log.mockRestore();
  }, 3000);

  test("shell handles multiline commands", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "line 1"; echo "line 2"; echo "line 3"`;

    expect(result.status).toBe("success");
    expect(result.output).toContain("line 1");
    expect(result.output).toContain("line 2");
    expect(result.output).toContain("line 3");

    console.log.mockRestore();
  }, 3000);

  test("shell handles pipes and redirection", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "hello world" | wc -w`;

    expect(result.status).toBe("success");
    expect(result.output.trim()).toBe("2");

    console.log.mockRestore();
  }, 3000);

  test("shell handles environment variables with .env()", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo $TEST_VAR`.env({
      TEST_VAR: "test_value",
    });

    expect(result.status).toBe("success");
    expect(result.output.trim()).toBe("test_value");

    console.log.mockRestore();
  }, 3000);

  test("shell handles working directory change with .cwd()", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`pwd`.cwd("/tmp");

    expect(result.status).toBe("success");
    expect(result.output.trim()).toBe("/tmp");

    console.log.mockRestore();
  }, 3000);

  test("shell handles chained env and cwd", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo $TEST_VAR && pwd`
      .env({ TEST_VAR: "chained_test" })
      .cwd("/tmp");

    expect(result.status).toBe("success");
    expect(result.output).toContain("chained_test");
    expect(result.output).toContain("/tmp");

    console.log.mockRestore();
  }, 3000);

  test("shell handles command failure correctly", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`exit 1`;

    expect(result.status).toBe("fail");
    expect(result.hasSucceeded).toBe(false);

    console.log.mockRestore();
  }, 3000);

  test("shell handles stderr output on failure", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "error message" >&2; exit 1`;

    expect(result.status).toBe("fail");
    expect(result.output).toContain("error message");

    console.log.mockRestore();
  }, 3000);

  test("shell handles complex shell operations", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`
      NAME="world"
      echo "Hello $NAME!"
      if [ -d "/tmp" ]; then
        echo "tmp directory exists"
      fi
    `;

    expect(result.status).toBe("success");
    expect(result.output).toContain("Hello world!");
    expect(result.output).toContain("tmp directory exists");

    console.log.mockRestore();
  }, 5000);

  test("shell function has correct API structure", () => {
    const shellCode = shellFunction.toString();
    expect(shellCode).toContain('from "bun"');
    expect(shellCode).toContain("shell.cwd");
    expect(shellCode).toContain("shell.env");
    expect(shellCode).toContain("shell`${cmd}`");
  });

  test("shell handles special characters and operators", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "hello world" && echo "success"`;

    expect(result.status).toBe("success");
    expect(result.output).toContain("hello world");
    expect(result.output).toContain("success");

    console.log.mockRestore();
  }, 3000);

  test("shell handles template literal interpolation", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const message = "interpolated";
    const result = await shellFunction`echo "${message} message"`;

    expect(result.status).toBe("success");
    expect(result.output).toContain("interpolated message");

    console.log.mockRestore();
  }, 3000);

  test("shell returns correct TaskResult structure", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`echo "test output"`;

    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("output");
    expect(result).toHaveProperty("hasSucceeded");
    expect(result.status).toBe("success");
    expect(result.hasSucceeded).toBe(true);
    expect(typeof result.output).toBe("string");

    console.log.mockRestore();
  }, 3000);

  test("shell handles empty output correctly", async () => {
    spyOn(console, "log").mockImplementation(mockConsoleLog);

    const result = await shellFunction`true`;

    expect(result.status).toBe("success");
    expect(result.output).toBe("");

    console.log.mockRestore();
  }, 3000);
});
