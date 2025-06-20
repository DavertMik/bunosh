// Bun test setup file
// Set environment variables before any modules are imported
process.env.FORCE_RICH_UI = '1';
delete process.env.CI;

// Note: Bun test runner doesn't need explicit timeout configuration like Jest
// Default timeout is adequate for these tests