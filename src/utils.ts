/**
 * Provides access to a promise's resolve and reject functions outside its constructor.
 *
 * This utility extracts the `resolve` and `reject` callbacks from a promise, enabling
 * control flow patterns where promise resolution needs to be triggered from external code
 * rather than within the promise constructor. Useful for event-driven architectures,
 * manual promise management, or coordinating multiple async operations.
 *
 * @template T - The type of value the promise will resolve with. Defaults to `void`.
 * @returns An object containing the promise and its control functions:
 *   - `promise`: The created promise instance
 *   - `resolve`: Function to resolve the promise with a value
 *   - `reject`: Function to reject the promise with a reason
 *
 * @example
 * ```typescript
 * // Manual promise control in an event handler
 * const { promise, resolve } = getPromiseWithResolvers<string>();
 *
 * button.addEventListener('click', () => {
 *   resolve('Button clicked!');
 * });
 *
 * const result = await promise; // Waits until button is clicked
 * ```
 *
 * @example
 * ```typescript
 * // Coordinating multiple async operations
 * const { promise, resolve, reject } = getPromiseWithResolvers<number>();
 *
 * if (condition) {
 *   resolve(42);
 * } else {
 *   reject(new Error('Condition not met'));
 * }
 * ```
 */
export function getPromiseWithResolvers<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

/**
 * Delays execution for a specified number of milliseconds.
 *
 * This utility pauses async execution without blocking the event loop, making it ideal
 * for rate limiting, debouncing, simulating network delays in tests, or adding deliberate
 * pauses in sequential operations. The delay is non-blocking and allows other tasks to
 * execute during the wait period.
 *
 * **Caveat:** Actual delay duration may vary slightly due to event loop scheduling and
 * system load. Delays exceeding approximately 24.9 days (2,147,483,647ms) are automatically
 * clamped to prevent integer overflow bugs in the underlying `setTimeout` implementation.
 * For precise timing requirements, consider using {@link animationFrame} in browser environments.
 *
 * @param ms - The number of milliseconds to wait. Must be non-negative. Values exceeding
 *   2,147,483,647 (maximum 32-bit signed integer) are clamped to prevent overflow.
 * @returns A promise that resolves after the specified delay with no value.
 *
 * @example
 * ```typescript
 * // Rate limiting API calls
 * for (const item of items) {
 *   await processItem(item);
 *   await timeout(1000); // Wait 1 second between requests
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Simulating network latency in tests
 * async function mockFetch(url: string) {
 *   await timeout(200); // Simulate 200ms network delay
 *   return { data: 'mock response' };
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Long delays are automatically safe
 * await timeout(Number.MAX_SAFE_INTEGER); // Clamped to ~24.9 days
 * ```
 */
export const timeout = (ms: number) =>
  new Promise(r => setTimeout(r, Math.min(2147483647, ms)));

/**
 * Defers execution to the next event loop cycle (macrotask).
 *
 * This utility yields control to allow other queued tasks—such as I/O operations, timers,
 * or UI rendering—to execute before continuing. Useful for preventing stack overflows in
 * deeply recursive async functions, breaking up long-running operations to maintain
 * responsiveness, or ensuring UI updates are processed between computational steps.
 *
 * **How it works:** Schedules a zero-delay timeout, which runs after the current execution
 * context completes and all pending microtasks are processed.
 *
 * **Performance note:** Macrotasks have lower priority than microtasks. If you need
 * higher-priority deferral, consider {@link microtask} instead.
 *
 * @returns A promise that resolves in the next macrotask queue with no value.
 *
 * @example
 * ```typescript
 * // Preventing stack overflow in recursive operations
 * async function processLargeTree(node: Node) {
 *   await processNode(node);
 *   await macrotask(); // Yield to event loop
 *   for (const child of node.children) {
 *     await processLargeTree(child);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Keeping UI responsive during computation
 * for (let i = 0; i < 1000; i++) {
 *   performHeavyComputation(i);
 *   if (i % 100 === 0) {
 *     await macrotask(); // Let browser update UI every 100 iterations
 *   }
 * }
 * ```
 */
export const macrotask = () => timeout(0);

/**
 * Defers execution to the microtask queue.
 *
 * This utility schedules a callback to run after the current synchronous code completes
 * but before any macrotasks (like timers or I/O). Ideal for high-priority async operations
 * that must execute before the next event loop turn, such as state synchronization in
 * reactive systems, flushing batched updates, or maintaining precise execution order in
 * complex promise chains.
 *
 * **Priority:** Microtasks execute before macrotasks, making them run sooner than
 * {@link macrotask} but after the current call stack clears.
 *
 * **Caveat:** Excessive microtask queueing can starve macrotasks (including UI rendering),
 * potentially causing unresponsiveness. Use judiciously in loops or recursive scenarios.
 *
 * @returns A promise that resolves in the microtask queue with no value.
 *
 * @example
 * ```typescript
 * // Ensuring state updates complete before next operation
 * function updateState(newState: State) {
 *   state = newState;
 *   microtask().then(() => notifyObservers(state));
 * }
 *
 * updateState(newValue);
 * // Observers notified after this synchronous code, but before timers
 * ```
 *
 * @example
 * ```typescript
 * // Execution order demonstration
 * console.log('1: sync');
 * macrotask().then(() => console.log('4: macrotask'));
 * microtask().then(() => console.log('3: microtask'));
 * console.log('2: sync');
 * // Output: 1, 2, 3, 4
 * ```
 */
export const microtask = () => new Promise<void>(queueMicrotask);

/**
 * Waits for the next browser animation frame and provides its timestamp.
 *
 * This utility synchronizes execution with the browser's display refresh rate (typically
 * 60Hz/16.67ms), making it essential for smooth animations, game loops, or any visual
 * updates that need to align with screen redraws. The timestamp provided is a high-resolution
 * monotonic clock value suitable for calculating frame deltas and animation progress.
 *
 * **Browser-only:** This function requires `requestAnimationFrame` and will throw an error
 * in Node.js or other non-browser environments.
 *
 * **Performance consideration:** Animation frames run at display refresh rate. For
 * non-visual async operations, {@link macrotask} or {@link microtask} may be more appropriate.
 *
 * @returns A promise that resolves with a `DOMHighResTimeStamp` (milliseconds since
 *   time origin) when the browser is ready to paint the next frame.
 *
 * @throws {Error} If called in a non-browser environment without `requestAnimationFrame`.
 *
 * @example
 * ```typescript
 * // Smooth animation loop
 * async function animate() {
 *   let lastTime = await animationFrame();
 *
 *   while (isAnimating) {
 *     const currentTime = await animationFrame();
 *     const deltaTime = currentTime - lastTime;
 *
 *     updateAnimation(deltaTime);
 *     render();
 *
 *     lastTime = currentTime;
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Ensuring visual update completes before next operation
 * element.style.transform = 'translateX(100px)';
 * await animationFrame(); // Wait for browser to paint the change
 * await animationFrame(); // Wait one more frame to ensure render completed
 * console.log('Animation visible to user');
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
