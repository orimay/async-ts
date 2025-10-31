function releaseStub() {
  return;
}

/**
 * A simple mutual exclusion lock for asynchronous code.
 * Mutex ensures that only one task can access a critical section at a time, preventing race conditions
 * in shared resources like databases, caches, or state objects. It's lightweight, promise-based,
 * and supports modern 'using' syntax for automatic release, making it ideal for Node.js, browsers,
 * or any async-heavy TypeScript project.
 *
 * Supports bypass mode for conditional locking, which is great for nested or optional synchronization.
 *
 * @example
 * ```typescript
 * const mutex = new Mutex();
 * const release = await mutex.obtain();
 * try {
 *   // Critical section
 * } finally {
 *   release();
 * }
 * ```
 */
export class Mutex {
  private m_lastPromise: Promise<void> = Promise.resolve();

  /**
   * Acquires the lock, waiting if necessary, and returns a release function.
   * If bypass is true, it returns a no-op release without waiting, allowing conditional skipping.
   * Always release in a finally block to avoid deadlocks.
   *
   * @param bypass - If true, skips acquiring the lock and returns a no-op release. Defaults to false.
   * @returns A promise resolving to a function that releases the lock.
   */
  public async obtain(bypass = false): Promise<() => void> {
    let release = releaseStub;
    if (bypass) return release;
    const lastPromise = this.m_lastPromise;
    this.m_lastPromise = new Promise<void>(resolve => (release = resolve));
    await lastPromise;
    return release;
  }

  /**
   * Acquires the lock and returns a disposable object for use with 'using' syntax.
   * The lock is automatically released when the scope exits, even on errors, providing
   * safer and more concise code. Supports bypass for conditional use.
   *
   * @param bypass - If true, skips acquiring the lock. Defaults to false.
   * @returns A promise resolving to an object with [Symbol.dispose] that releases the lock.
   * @example
   * ```typescript
   * {
   *   using _ = await mutex.lock();
   *   // Critical section, auto-released on exit
   * }
   * ```
   */
  public async lock(bypass = false) {
    return {
      [Symbol.dispose]: await this.obtain(bypass),
    };
  }
}

/**
 * A read-write mutual exclusion lock for optimizing concurrent access.
 * MutexRW allows multiple readers to access simultaneously for high-throughput reads,
 * while ensuring exclusive access for writers. This is perfect for cache systems, databases,
 * or any read-heavy/write-occasional scenarios in asynchronous code. It prevents starvation
 * and supports modern 'using' syntax for automatic management.
 *
 * Readers can overlap, but writers block all until exclusive access is granted.
 *
 * @example
 * ```typescript
 * const mutexRW = new MutexRW();
 * const releaseRO = await mutexRW.obtainRO();
 * try {
 *   // Read operation
 * } finally {
 *   releaseRO();
 * }
 * ```
 */
export class MutexRW {
  private m_nextRWPromise: Promise<void> = Promise.resolve();
  private m_lastRWPromise: Promise<void> = Promise.resolve();
  private m_lastROPromise: Promise<unknown> = Promise.resolve();
  private roAccessCnt = 0;
  private rwAccess = false;

  /**
   * Acquires a read lock, allowing multiple concurrent readers.
   * Waits if a writer is active. Returns a release function that must be called
   * in a finally block to decrement the reader count.
   *
   * @returns A promise resolving to a function that releases the read lock.
   */
  public async obtainRO(): Promise<() => void> {
    while (this.rwAccess) await this.m_lastRWPromise;
    ++this.roAccessCnt;
    let releaseRO = releaseStub;
    const thisROPromise = new Promise<void>(resolve => (releaseRO = resolve));
    this.m_lastROPromise = Promise.all([thisROPromise, this.m_lastROPromise]);
    void thisROPromise.then(() => --this.roAccessCnt);
    // Uncomment to detect deadlocks
    // const s = new Error().stack;
    // Promise.race([thisROPromise, timeout(10000).then(() => true)]).then(
    //   v => v === true && console.warn('possible deadlock', s),
    // );
    return releaseRO;
  }

  /**
   * Acquires a read lock and returns a disposable object for 'using' syntax.
   * Automatically releases the read lock on scope exit, simplifying error-prone manual management.
   *
   * @returns A promise resolving to an object with [Symbol.dispose] that releases the read lock.
   * @example
   * ```typescript
   * {
   *   using _ = await mutexRW.lockRO();
   *   // Read section, auto-released
   * }
   * ```
   */
  public async lockRO() {
    return {
      [Symbol.dispose]: await this.obtainRO(),
    };
  }

  /**
   * Acquires a write lock, ensuring exclusive access.
   * Waits for all readers and previous writers to finish. Returns a release function
   * that must be called in a finally block to allow others to proceed.
   *
   * @returns A promise resolving to a function that releases the write lock.
   */
  public async obtainRW(): Promise<() => void> {
    let releaseRW = releaseStub;
    const prevRWPromise = this.m_nextRWPromise;
    const thisRWPromise = new Promise<void>(resolve => (releaseRW = resolve));
    this.m_nextRWPromise = thisRWPromise;
    await prevRWPromise;
    while (this.roAccessCnt) await this.m_lastROPromise;
    this.rwAccess = true;
    this.m_lastRWPromise = thisRWPromise;
    void this.m_lastRWPromise.then(() => (this.rwAccess = false));
    return releaseRW;
  }

  /**
   * Acquires a write lock and returns a disposable object for 'using' syntax.
   * Automatically releases the write lock on scope exit, ensuring safety in complex flows.
   *
   * @returns A promise resolving to an object with [Symbol.dispose] that releases the write lock.
   * @example
   * ```typescript
   * {
   *   using _ = await mutexRW.lockRW();
   *   // Write section, auto-released
   * }
   * ```
   */
  public async lockRW() {
    return {
      [Symbol.dispose]: await this.obtainRW(),
    };
  }
}
