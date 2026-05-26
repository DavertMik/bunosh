import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import assert from '../src/tasks/assert.js';
import { task, tryTask, TaskStatus, tasksExecuted, ignoreFailures, stopOnFailures } from '../src/task.js';

const noop = mock(() => {});

afterEach(() => {
  ignoreFailures();
});

function failsRecorded() {
  return tasksExecuted.filter(t => t.result?.status === TaskStatus.FAIL).length;
}

describe('task.try isolates failures from exit code', () => {
  test('assert inside task.try does not produce a FAIL task', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const before = failsRecorded();

    const ok = await tryTask('outer', () => {
      assert(false, 'inner failure');
    });

    expect(ok).toBe(false);
    expect(failsRecorded()).toBe(before);

    const innerAssert = tasksExecuted.find(t => t.name === 'inner failure');
    expect(innerAssert).toBeDefined();
    expect(innerAssert.status).toBe(TaskStatus.WARNING);
    expect(innerAssert.isInsideTry).toBe(true);

    console.log.mockRestore();
  });

  test('a throwing task() inside task.try does not produce a FAIL', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const before = failsRecorded();

    const ok = await tryTask(() => task('inner', () => { throw new Error('boom'); }));

    expect(ok).toBe(false);
    expect(failsRecorded()).toBe(before);

    console.log.mockRestore();
  });

  test('task.try with stopOnFailures still does not exit on inner failure', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {});

    stopOnFailures();

    const ok = await tryTask(() => task('inner', () => { throw new Error('boom'); }));

    expect(ok).toBe(false);
    expect(exitSpy).not.toHaveBeenCalled();

    process.exit.mockRestore();
    console.log.mockRestore();
  });

  test('task.try returns false when fn returns undefined but inner task failed', async () => {
    spyOn(console, 'log').mockImplementation(noop);

    const ok = await tryTask(() => {
      assert(false, 'sneaky');
    });

    expect(ok).toBe(false);

    console.log.mockRestore();
  });

  test('task.try returns true when nothing failed', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const before = failsRecorded();

    const ok = await tryTask(() => {
      assert(true, 'all good');
    });

    expect(ok).toBe(true);
    expect(failsRecorded()).toBe(before);

    console.log.mockRestore();
  });

  test('nested task.try also isolates', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const before = failsRecorded();

    const ok = await tryTask(() => tryTask(() => assert(false, 'deep')));

    expect(ok).toBe(false);
    expect(failsRecorded()).toBe(before);

    console.log.mockRestore();
  });

  test('failure outside task.try still produces a FAIL', async () => {
    spyOn(console, 'log').mockImplementation(noop);
    const before = failsRecorded();

    assert(false, 'real failure');

    expect(failsRecorded()).toBe(before + 1);

    console.log.mockRestore();
  });
});
