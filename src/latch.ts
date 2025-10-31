/**
 * A synchronization primitive that acts as a gate for awaiting promises.
 * Latch can be opened or closed to control flow in asynchronous code, similar to a manual reset event.
 * It's invaluable for coordinating startup/shutdown sequences, waiting for initialization,
 * or managing phased executions in distributed systems, workers, or event-driven architectures.
 * Supports usage counting for multiple concurrent 'uses' that keep it closed until all are released.
 *
 * Starts closed by default.
 *
 * @example
 * ```typescript
 * const latch = new Latch();
 * // In one part of code
 * await latch.gate; // Waits until opened
 * // In another
 * latch.open(); // Releases waiters
 * ```
 */
export class Latch {
  private m_open: (() => void) | null = null;
  private m_gate!: Promise<void>;

  /**
   * Initializes a new Latch instance in the closed state.
   * The gate promise will not resolve until open() is called.
   */
  public constructor() {
    this.close();
  }

  /**
   * Gets a promise that resolves when the latch is opened.
   * If the latch state changes during await, it recursively awaits the new gate
   * to ensure correctness in dynamic scenarios.
   *
   * @returns A promise that resolves with void when the latch is open.
   */
  public get gate(): Promise<void> {
    const gate = this.m_gate;
    return gate.then(() => (this.m_gate === gate ? undefined : this.gate));
  }

  /**
   * Opens the latch, resolving the current gate promise.
   * No-op if already open. Allows all awaiting code to proceed.
   */
  public open() {
    if (this.m_open === null) return;
    this.m_open();
    this.m_open = null;
  }

  /**
   * Closes the latch, creating a new unresolved gate promise.
   * If previously open, resolves the old gate but sets a new closed one.
   * Useful for resetting or reusing the latch.
   */
  public close() {
    const open = this.m_open;
    this.m_gate = new Promise<void>(r => (this.m_open = r));

    if (open !== null) {
      // make sure the old latch gate is now open
      open();
    }
  }

  private m_inUse = 0;

  /**
   * Increments the usage counter, closes the latch, and returns a disposable.
   * The latch remains closed until all uses are disposed and the optional condition (if provided) is true.
   * Perfect for managing resources that require multiple async operations to complete before proceeding.
   *
   * @param condition - Optional function that must return true to open on final dispose.
   * @returns A disposable object that decrements the count and potentially opens the latch on dispose.
   * @example
   * ```typescript
   * {
   *   using _ = latch.use(() => someCondition);
   *   // Latch closed during this scope
   * } // Opens if count == 0 and condition true
   * ```
   */
  public use(condition?: () => boolean) {
    ++this.m_inUse;
    this.close();
    return {
      [Symbol.dispose]: () => {
        !--this.m_inUse &&
          (condition === undefined || condition()) &&
          this.open();
      },
    };
  }
}
