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

  private m_waitingCount = 0;
  private m_isLocked = false;

  /**
   * The number of tasks currently waiting to acquire the lock.
   * Does not include the task that currently holds the lock.
   * Useful for monitoring contention and making decisions about load balancing or backpressure.
   *
   * @returns The count of waiting tasks in the queue.
   *
   * @example
   * ```typescript
   * const mutex = new Mutex();
   * console.log(mutex.waitingCount); // 0
   *
   * const release1 = await mutex.obtain();
   * console.log(mutex.waitingCount); // 0 (lock held, but no one waiting)
   *
   * const promise2 = mutex.obtain(); // This will wait
   * console.log(mutex.waitingCount); // 1
   *
   * release1();
   * ```
   */
  public get waitingCount() {
    return this.m_waitingCount;
  }

  /**
   * Whether the mutex is currently locked (a task is holding the lock).
   * Returns true if any task is currently holding the lock, regardless of whether others are waiting.
   *
   * @returns true if the mutex is locked, false otherwise.
   *
   * @example
   * ```typescript
   * const mutex = new Mutex();
   * console.log(mutex.isLocked); // false
   *
   * const release = await mutex.obtain();
   * console.log(mutex.isLocked); // true
   *
   * release();
   * await Promise.resolve();
   * console.log(mutex.isLocked); // false
   * ```
   */
  public get isLocked() {
    return this.m_isLocked;
  }

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
    ++this.m_waitingCount;
    await lastPromise;
    --this.m_waitingCount;
    this.m_isLocked = true;
    const originalRelease = release;
    release = () => {
      this.m_isLocked = false;
      originalRelease();
    };
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
  private m_activeReadCount = 0;
  private m_isWriteLocked = false;

  private m_readWaitingCount = 0;

  /**
   * The number of tasks currently waiting to acquire a read lock.
   * Does not include tasks that currently hold a read lock.
   * Useful for monitoring read contention and balancing read vs write priorities.
   *
   * @returns The count of waiting read tasks in the queue.
   *
   * @example
   * ```typescript
   * const mutexRW = new MutexRW();
   * console.log(mutexRW.readWaitingCount); // 0
   *
   * const release1 = await mutexRW.obtainRead();
   * console.log(mutexRW.readWaitingCount); // 0 (read lock held, but no one waiting)
   *
   * // Start a write operation (blocks reads)
   * const writePromise = mutexRW.obtainWrite();
   *
   * // Now new reads will wait
   * const readPromise = mutexRW.obtainRead();
   * console.log(mutexRW.readWaitingCount); // 1
   *
   * release1();
   * ```
   */
  public get readWaitingCount() {
    return this.m_readWaitingCount;
  }

  /**
   * Whether any read locks are currently held by tasks.
   * Returns true if one or more tasks are currently holding read locks.
   * Multiple readers can hold locks simultaneously.
   *
   * @returns true if read locks are held, false otherwise.
   *
   * @example
   * ```typescript
   * const mutexRW = new MutexRW();
   * console.log(mutexRW.isReadLocked); // false
   *
   * const release1 = await mutexRW.obtainRead();
   * console.log(mutexRW.isReadLocked); // true
   *
   * const release2 = await mutexRW.obtainRead();
   * console.log(mutexRW.isReadLocked); // true (multiple readers)
   *
   * release1();
   * console.log(mutexRW.isReadLocked); // true (still one reader)
   *
   * release2();
   * await Promise.resolve();
   * console.log(mutexRW.isReadLocked); // false
   * ```
   */
  public get isReadLocked() {
    return this.m_activeReadCount > 0;
  }

  private m_writeWaitingCount = 0;

  /**
   * The number of tasks currently waiting to acquire a write lock.
   * Does not include the task that currently holds a write lock (if any).
   * Useful for monitoring write contention and detecting potential write starvation.
   *
   * @returns The count of waiting write tasks in the queue.
   *
   * @example
   * ```typescript
   * const mutexRW = new MutexRW();
   * console.log(mutexRW.writeWaitingCount); // 0
   *
   * const release1 = await mutexRW.obtainWrite();
   * console.log(mutexRW.writeWaitingCount); // 0 (write lock held, but no one waiting)
   *
   * const promise2 = mutexRW.obtainWrite(); // This will wait
   * console.log(mutexRW.writeWaitingCount); // 1
   *
   * release1();
   * ```
   */
  public get writeWaitingCount() {
    return this.m_writeWaitingCount;
  }

  /**
   * Whether a write lock is currently held by a task.
   * Returns true if a task is currently holding the write lock (exclusive access).
   * Only one task can hold a write lock at a time.
   *
   * @returns true if write lock is held, false otherwise.
   *
   * @example
   * ```typescript
   * const mutexRW = new MutexRW();
   * console.log(mutexRW.isWriteLocked); // false
   *
   * const release = await mutexRW.obtainWrite();
   * console.log(mutexRW.isWriteLocked); // true
   *
   * release();
   * await Promise.resolve();
   * console.log(mutexRW.isWriteLocked); // false
   * ```
   */
  public get isWriteLocked() {
    return this.m_isWriteLocked;
  }

  /**
   * The number of tasks currently holding a read lock.
   * Multiple readers can hold the lock simultaneously.
   * Useful for understanding current read load and diagnosing performance.
   *
   * @returns The count of active readers.
   *
   * @example
   * ```typescript
   * const mutexRW = new MutexRW();
   * console.log(mutexRW.activeReadCount); // 0
   *
   * const release1 = await mutexRW.obtainRead();
   * console.log(mutexRW.activeReadCount); // 1
   *
   * const release2 = await mutexRW.obtainRead();
   * console.log(mutexRW.activeReadCount); // 2
   *
   * release1();
   * console.log(mutexRW.activeReadCount); // 1
   * ```
   */
  public get activeReadCount() {
    return this.m_activeReadCount;
  }

  /**
   * Acquires a read lock, allowing multiple concurrent readers.
   * Waits if a writer is active. Returns a release function that must be called
   * in a finally block to decrement the reader count.
   *
   * @returns A promise resolving to a function that releases the read lock.
   */
  public async obtainRead(): Promise<() => void> {
    ++this.m_readWaitingCount;
    while (this.m_writeWaitingCount) await this.m_nextRWPromise;
    while (this.m_isWriteLocked) await this.m_lastRWPromise;
    --this.m_readWaitingCount;
    ++this.m_activeReadCount;
    let releaseRead = releaseStub;
    const thisReadPromise = new Promise<void>(
      resolve => (releaseRead = resolve),
    );
    this.m_lastROPromise = Promise.all([thisReadPromise, this.m_lastROPromise]);
    void thisReadPromise.then(() => --this.m_activeReadCount);
    // Uncomment to detect deadlocks
    // const s = new Error().stack;
    // Promise.race([thisReadPromise, timeout(10000).then(() => true)]).then(
    //   v => v === true && console.warn('possible deadlock', s),
    // );
    return releaseRead;
  }

  /**
   * Acquires a read lock and returns a disposable object for 'using' syntax.
   * Automatically releases the read lock on scope exit, simplifying error-prone manual management.
   *
   * @returns A promise resolving to an object with [Symbol.dispose] that releases the read lock.
   * @example
   * ```typescript
   * {
   *   using _ = await mutexRW.lockRead();
   *   // Read section, auto-released
   * }
   * ```
   */
  public async lockRead() {
    return {
      [Symbol.dispose]: await this.obtainRead(),
    };
  }

  /**
   * Acquires a write lock, ensuring exclusive access.
   * Waits for all readers and previous writers to finish. Returns a release function
   * that must be called in a finally block to allow others to proceed.
   *
   * @returns A promise resolving to a function that releases the write lock.
   */
  public async obtainWrite(): Promise<() => void> {
    let releaseWrite = releaseStub;
    const prevWritePromise = this.m_nextRWPromise;
    const thisWritePromise = new Promise<void>(
      resolve => (releaseWrite = resolve),
    );
    this.m_nextRWPromise = thisWritePromise;
    ++this.m_writeWaitingCount;
    await prevWritePromise;
    while (this.m_activeReadCount) await this.m_lastROPromise;
    --this.m_writeWaitingCount;
    this.m_isWriteLocked = true;
    this.m_lastRWPromise = thisWritePromise;
    void this.m_lastRWPromise.then(() => (this.m_isWriteLocked = false));
    return releaseWrite;
  }

  /**
   * Acquires a write lock and returns a disposable object for 'using' syntax.
   * Automatically releases the write lock on scope exit, ensuring safety in complex flows.
   *
   * @returns A promise resolving to an object with [Symbol.dispose] that releases the write lock.
   * @example
   * ```typescript
   * {
   *   using _ = await mutexRW.lockWrite();
   *   // Write section, auto-released
   * }
   * ```
   */
  public async lockWrite() {
    return {
      [Symbol.dispose]: await this.obtainWrite(),
    };
  }

  // Backward compatibility aliases
  /** @deprecated Use obtainRead() instead */
  public obtainRO = this.obtainRead;
  /** @deprecated Use lockRead() instead */
  public lockRO = this.lockRead;
  /** @deprecated Use obtainWrite() instead */
  public obtainRW = this.obtainWrite;
  /** @deprecated Use lockWrite() instead */
  public lockRW = this.lockWrite;
}
