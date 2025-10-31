/**
 * A utility class to manage and wait for the completion of tracked promises.
 * PromiseBarrier is designed for scenarios where you need to coordinate multiple asynchronous operations,
 * such as awaiting all background tasks before proceeding, handling batch processing, or ensuring
 * resource cleanup in concurrent environments. It efficiently tracks promises and provides a 'free'
 * promise that resolves only when all tracked promises have settled (resolved or rejected).
 *
 * This class is particularly useful in server-side rendering, API orchestration, or any system
 * requiring synchronization of promises without blocking the main thread.
 *
 * @example
 * ```typescript
 * const barrier = new PromiseBarrier();
 * barrier.add(someAsyncOperation());
 * barrier.add(anotherAsyncOperation());
 * await barrier.free; // Waits until both operations complete
 * ```
 */
export class PromiseBarrier {
  private readonly m_activePromises = new Set<Promise<unknown>>();

  /**
   * Tracks a promise, ensuring it's monitored until completion.
   * The promise is added to the internal set and automatically removed upon settlement.
   * Errors are caught silently to prevent unhandled rejections from affecting tracking.
   *
   * @param promise - The promise to track. Can be any Promise<unknown>.
   */
  public add(promise: Promise<unknown>) {
    this.m_activePromises.add(promise);
    void promise
      .catch(() => {
        return;
      })
      .finally(() => this.m_activePromises.delete(promise));
  }

  private m_cachedFree: null | Promise<void> = null;
  /**
   * A promise that resolves once all tracked promises have completed (settled).
   * If no promises are tracked, it resolves immediately. The result is cached for efficiency
   * but invalidated as new promises are added. This property is read-only and can be awaited
   * multiple times safely.
   *
   * @returns A promise that resolves with void when all tracked promises are settled.
   */
  public get free(): Promise<void> {
    if (this.m_cachedFree !== null) return this.m_cachedFree;
    if (this.m_activePromises.size === 0) return Promise.resolve();
    return (this.m_cachedFree = Promise.allSettled(this.m_activePromises).then(
      () => ((this.m_cachedFree = null), this.free),
    ));
  }
}
