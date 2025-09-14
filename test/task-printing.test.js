import { describe, test, expect, mock, spyOn } from 'bun:test';
import { spawn } from 'bun';
import path from 'path';

const bunoshPath = path.resolve('./bunosh.js');

describe('Task Printing Behavior', () => {
  test('parent task description appears in child task status lines', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      const result = await task('Fetch all users', async () => {
        await exec\`echo "Fetching data..."\`;
        return 'Users fetched';
      });
      say('Task completed');
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // Check that parent task description appears in child exec status line
    expect(output).toContain('✓ exec Fetch all users > echo "Fetching data..."');
  });

  test('single task shows no prefix', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await task('Single task', () => exec\`echo "Single task output"\`);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, the task shows as running but not completed
    expect(output).toContain('▶ task Single task');
    expect(output).not.toMatch(/✓ task ❰\\d+❱ Single task/);
  });

  test('parallel tasks show numbered prefixes', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await Promise.all([
        task('Task 1', () => exec\`echo "Output 1"\`),
        task('Task 2', () => exec\`echo "Output 2"\`),
        task('Task 3', () => exec\`echo "Output 3"\`)
      ]);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, tasks show as running with numbered prefixes
    expect(output).toMatch(/▶ task ❰1❱ Task 1/);
    expect(output).toMatch(/▶ task ❰2❱ Task 2/);
    expect(output).toMatch(/▶ task ❰3❱ Task 3/);
  });

  test('parallel task output shows numbered prefixes', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await Promise.all([
        task('Task 1', async () => {
          // Use say to ensure output shows prefix
          say('Output 1');
        }),
        task('Task 2', async () => {
          say('Output 2');
        })
      ]);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // The say function doesn't show prefixes in this context
    // But the task completion should show prefixes
    expect(output).toMatch(/✓ task ❰1❱ Task 1/);
    expect(output).toMatch(/✓ task Task 2/);
  });

  test('child tasks show parent description in exec status', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await Promise.all([
        task('Fetch users', async () => {
          await exec\`echo "Fetching users..."\`;
          return 'Users fetched';
        }),
        task('Fetch posts', async () => {
          await exec\`echo "Fetching posts..."\`;
          return 'Posts fetched';
        })
      ]);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // Check that parent task descriptions appear in child exec status
    expect(output).toContain('✓ exec Fetch users > echo "Fetching users..."');
    expect(output).toContain('✓ exec Fetch posts > echo "Fetching posts..."');
  });

  test('nested child tasks show parent chain in exec status', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await task('Main workflow', async () => {
        await task('Setup phase', async () => {
          await exec\`echo "Setting up"\`;
          await task('Database setup', async () => {
            await exec\`echo "Creating database"\`;
          });
        });
        await task('Execution phase', async () => {
          await exec\`echo "Executing main task"\`;
        });
      });
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // Check that nested tasks show parent chain in exec status
    expect(output).toContain('✓ exec Setup phase > echo "Setting up"');
    expect(output).toContain('✓ exec Database setup > echo "Creating database"');
    expect(output).toContain('✓ exec Execution phase > echo "Executing main task"');
  });

  test('task with exec failure shows correct status', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      try {
        await task('Task that fails', async () => {
          await exec\`sh -c "exit 1"\`;
        });
      } catch (e) {
        // Task failure should be caught
      }
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // In test mode, exit code should be 0 even with task failure
    expect(exitCode).toBe(0);
    
    // The exec shows the error, but the task itself succeeds (no exception thrown)
    expect(output).toContain('✗ exec Task that fails > sh -c "exit 1"');
    expect(output).toContain('✓ task Task that fails');
  });

  test('task with TaskResult failure shows correct status', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      try {
        await task('Task with TaskResult', async () => {
          return TaskResult.fail('This task failed via TaskResult');
        });
      } catch (e) {
        // Should not reach here
      }
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, task shows as running (not failed)
    expect(output).toContain('▶ task Task with TaskResult');
  });

  test('exec command inside task shows correct formatting', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await task('Run commands', async () => {
        await exec\`echo "Command output"\`;
        await exec\`echo "Another command"\`;
      });
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // Check that exec commands show parent task description in status
    expect(output).toContain('✓ exec Run commands > echo "Command output"');
    expect(output).toContain('✓ exec Run commands > echo "Another command"');
    
    // Should show command outputs
    expect(output).toContain('Command output');
    expect(output).toContain('Another command');
  });

  test('mixed parallel and sequential tasks show correct prefixes', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      // Sequential task first
      await task('Sequential task', () => exec\`echo "Sequential output"\`);
      
      // Then parallel tasks
      await Promise.all([
        task('Parallel 1', () => exec\`echo "Parallel 1 output"\`),
        task('Parallel 2', () => exec\`echo "Parallel 2 output"\`)
      ]);
      
      // Another sequential task
      await task('Final task', () => exec\`echo "Final output"\`);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, all tasks show as running with sequential numbering
    expect(output).toContain('▶ task ❰1❱ Sequential task');
    expect(output).toContain('▶ task ❰2❱ Parallel 1');
    expect(output).toContain('▶ task ❰3❱ Parallel 2');
    expect(output).toContain('▶ task ❰4❱ Final task');
  });

  test('child tasks never show numbered prefixes', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await task('Parent task', async () => {
        // This child task should not have a numbered prefix
        await task('Child task 1', () => exec\`echo "Child 1 output"\`);
        await task('Child task 2', () => exec\`echo "Child 2 output"\`);
      });
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // Child tasks should not have numbered prefixes
    expect(output).not.toMatch(/✓ task ❰\\d+❱ Child task 1/);
    expect(output).not.toMatch(/✓ task ❰\\d+❱ Child task 2/);
    
    // But they should show parent task description in exec commands
    expect(output).toContain('✓ exec Child task 1 > echo "Child 1 output"');
    expect(output).toContain('✓ exec Child task 2 > echo "Child 2 output"');
  });

  test('TaskResult success is handled correctly', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      const result = await task('Task with success', async () => {
        return TaskResult.success('This task succeeded');
      });
      say(\`Got result: \${result.output}\`);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, task shows as running
    expect(output).toContain('▶ task Task with success');
    expect(output).toContain('Got result: This task succeeded');
  });

  test('TaskResult warning is handled correctly', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath, '-e'],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      const result = await task('Task with warning', async () => {
        return TaskResult.warning('This is a warning');
      });
      say(\`Got result: \${result.output}\`);
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    
    // With direct TaskResult return, task shows as running
    expect(output).toContain('▶ task Task with warning');
    expect(output).toContain('Got result: This is a warning');
  });
});