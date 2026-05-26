import { describe, test, expect, mock, spyOn, afterEach } from 'bun:test';
import assert from '../src/tasks/assert.js';
import { tasksExecuted, TaskStatus, ignoreFailures, stopOnFailures, isStopOnFailuresMode } from '../src/task.js';

const noop = mock(() => {});

afterEach(() => {
  ignoreFailures();
});

describe('assert', () => {
  test('truthy condition records a successful task and returns undefined', () => {
    spyOn(console, 'log').mockImplementation(noop);

    const initial = tasksExecuted.length;
    const ret = assert(true, 'ok');

    expect(ret).toBeUndefined();
    expect(tasksExecuted.length).toBe(initial + 1);
    expect(tasksExecuted[tasksExecuted.length - 1].status).toBe(TaskStatus.SUCCESS);

    console.log.mockRestore();
  });

  test('falsy condition records a failed task and does not throw', () => {
    spyOn(console, 'log').mockImplementation(noop);

    const initial = tasksExecuted.length;

    expect(() => assert(false, 'nope')).not.toThrow();
    expect(tasksExecuted.length).toBe(initial + 1);

    const last = tasksExecuted[tasksExecuted.length - 1];
    expect(last.status).toBe(TaskStatus.FAIL);
    expect(last.name).toBe('nope');
    expect(last.result.output).toBe('nope');

    console.log.mockRestore();
  });

  test('default message is used when none provided', () => {
    spyOn(console, 'log').mockImplementation(noop);

    assert(false);

    const last = tasksExecuted[tasksExecuted.length - 1];
    expect(last.name).toBe('Assertion failed');

    console.log.mockRestore();
  });

  test('multiple failed asserts in a row all run and are counted', () => {
    spyOn(console, 'log').mockImplementation(noop);

    const initial = tasksExecuted.length;

    assert(false, 'first');
    assert(false, 'second');
    assert(true, 'third-ok');

    expect(tasksExecuted.length).toBe(initial + 3);
    expect(tasksExecuted[initial].status).toBe(TaskStatus.FAIL);
    expect(tasksExecuted[initial + 1].status).toBe(TaskStatus.FAIL);
    expect(tasksExecuted[initial + 2].status).toBe(TaskStatus.SUCCESS);

    console.log.mockRestore();
  });

  test('stopOnFailures attempts process.exit on failure (suppressed in test env)', () => {
    spyOn(console, 'log').mockImplementation(noop);
    const exitSpy = spyOn(process, 'exit').mockImplementation(() => {});

    stopOnFailures();
    expect(isStopOnFailuresMode()).toBe(true);

    assert(false, 'should not exit in test env');

    expect(exitSpy).not.toHaveBeenCalled();

    process.exit.mockRestore();
    console.log.mockRestore();
  });
});
