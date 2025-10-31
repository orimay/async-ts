/**
 * Creates a promise that resolves after a specified number of milliseconds.
 * This utility is useful for introducing delays in asynchronous code, such as rate limiting,
 * simulating network latency, or coordinating timed operations in complex workflows.
 * It leverages the native `setTimeout` for efficient, non-blocking waiting.
 *
 * @param ms - The number of milliseconds to wait before resolving the promise. Must be a non-negative number.
 * @returns A promise that resolves with no value after the specified timeout.
 * @example
 * ```typescript
 * await timeout(1000); // Waits for 1 second
 * console.log('Delayed execution');
 * ```
 */
export const timeout = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Creates a macrotask by scheduling a promise that resolves immediately after the current event loop turn.
 * Macrotasks are useful for deferring execution to the next event loop iteration, allowing other tasks
 * like rendering or I/O to process first. This can help in avoiding stack overflows in recursive async functions
 * or ensuring UI updates in browser environments.
 *
 * @returns A promise that resolves in the next macrotask.
 * @example
 * ```typescript
 * await macrotask();
 * // Code here runs after the current event loop completes
 * ```
 */
export const macrotask = () => timeout(0);

/**
 * Creates a microtask by queuing a promise resolution via `queueMicrotask`.
 * Microtasks execute before the next macrotask, making them ideal for high-priority async operations
 * that need to run as soon as the current call stack clears, such as state updates in reactive systems
 * or fine-grained control in promise chains.
 *
 * @returns A promise that resolves in the next microtask.
 * @example
 * ```typescript
 * microtask().then(() => console.log('Microtask executed'));
 * // This logs after the current stack but before macrotasks
 * ```
 */
export const microtask = () => new Promise<void>(queueMicrotask);

/**
 * Creates a promise that resolves on the next animation frame, providing the timestamp.
 * This is essential for smooth animations, game loops, or any time-sensitive rendering tasks
 * in browser environments. It synchronizes with the display's refresh rate for optimal performance.
 * Throws an error if not in a browser environment.
 *
 * @returns A promise that resolves with the high-resolution timestamp of the animation frame.
 * @example
 * ```typescript
 * const time = await animationFrame();
 * console.log(`Frame at ${time}ms`);
 * ```
 */
export const animationFrame = () =>
  new Promise<number>(
    (
      globalThis as {
        requestAnimationFrame?: (callback: (time: number) => void) => number;
      }
    ).requestAnimationFrame ??
      (() => {
        throw new Error('`animationFrame` requires a browser environment');
      }),
  );
