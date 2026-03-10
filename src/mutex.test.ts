import { describe, expect, it } from 'vitest';
import { Mutex, MutexRW, timeout } from '.';

describe('mutex', { timeout: 10000 }, () => {
  it.concurrent('works with errors', async () => {
    const mutex = new Mutex();
    let cntAccess = 0;
    const f = async () => {
      using _ = await mutex.lock();
      expect(++cntAccess).toBe(1);
      await timeout(Math.random() * 10);
      --cntAccess;
      if (Math.random() > 0.5) throw new Error();
    };
    const threads: Promise<unknown>[] = [];
    for (let i = 0; i < 100; ++i) {
      threads.push(f());
    }
    await Promise.allSettled(threads);
    expect(cntAccess).toBe(0);
  });

  it.concurrent('never allows accessors interfere', async () => {
    const mutex = new Mutex();
    let cntAccess = 0;
    const f = async () => {
      const release = await mutex.obtain();
      expect(++cntAccess).toBe(1);
      await timeout(Math.random() * 10);
      --cntAccess;
      try {
        if (Math.random() > 0.5) throw new Error();
      } finally {
        release();
      }
    };
    const threads: Promise<unknown>[] = [];
    for (let i = 0; i < 100; ++i) {
      threads.push(f());
    }
    await Promise.allSettled(threads);
    expect(cntAccess).toBe(0);
  });

  it.concurrent('never allows accessors interfere, with automatic disposal', async () => {
    const mutex = new Mutex();
    let cntAccess = 0;
    const f = async () => {
      using _ = await mutex.lock();
      expect(++cntAccess).toBe(1);
      await timeout(Math.random() * 10);
      --cntAccess;
      if (Math.random() > 0.5) throw new Error();
    };
    const threads: Promise<unknown>[] = [];
    for (let i = 0; i < 100; ++i) {
      threads.push(f());
    }
    await Promise.allSettled(threads);
    expect(cntAccess).toBe(0);
  });

  describe('status properties', () => {
    describe('waitingCount', () => {
      it('returns 0 when unlocked', () => {
        const mutex = new Mutex();
        expect(mutex.waitingCount).toBe(0);
      });

      it('returns 0 when locked but no waiters', async () => {
        const mutex = new Mutex();
        const release = await mutex.obtain();
        expect(mutex.waitingCount).toBe(0);
        release();
      });

      it('increases with waiting tasks', async () => {
        const mutex = new Mutex();
        const release1 = await mutex.obtain();

        // These will wait
        const promise2 = mutex.obtain();
        const promise3 = mutex.obtain();

        // Allow microtask queue to process
        await Promise.resolve();

        expect(mutex.waitingCount).toBe(2);

        release1();
        const release2 = await promise2;
        expect(mutex.waitingCount).toBe(1);

        release2();
        const release3 = await promise3;
        expect(mutex.waitingCount).toBe(0);

        release3();
      });
    });

    describe('isLocked', () => {
      it('is false when unlocked', () => {
        const mutex = new Mutex();
        expect(mutex.isLocked).toBe(false);
      });

      it('is true when lock is held', async () => {
        const mutex = new Mutex();
        const release = await mutex.obtain();
        expect(mutex.isLocked).toBe(true);
        release();

        // Allow microtask queue to process
        await Promise.resolve();
        expect(mutex.isLocked).toBe(false);
      });

      it('is true when lock is held even if no one is waiting', async () => {
        const mutex = new Mutex();
        const release = await mutex.obtain();

        expect(mutex.isLocked).toBe(true);
        expect(mutex.waitingCount).toBe(0);

        release();
        await Promise.resolve();
        expect(mutex.isLocked).toBe(false);
      });

      it('is true when lock is held and tasks are waiting', async () => {
        const mutex = new Mutex();
        const release1 = await mutex.obtain();

        const promise2 = mutex.obtain();
        await Promise.resolve();

        expect(mutex.isLocked).toBe(true);
        expect(mutex.waitingCount).toBe(1);

        release1();
        const release2 = await promise2;

        expect(mutex.isLocked).toBe(true);
        expect(mutex.waitingCount).toBe(0);

        release2();
        await Promise.resolve();
        expect(mutex.isLocked).toBe(false);
      });
    });

    it('status properties work correctly with using syntax', async () => {
      const mutex = new Mutex();
      expect(mutex.isLocked).toBe(false);
      expect(mutex.waitingCount).toBe(0);

      {
        using _ = await mutex.lock();
        expect(mutex.isLocked).toBe(true);
        expect(mutex.waitingCount).toBe(0);
      }

      await Promise.resolve();
      expect(mutex.isLocked).toBe(false);
      expect(mutex.waitingCount).toBe(0);
    });

    it('tracks multiple concurrent waiting tasks', async () => {
      const mutex = new Mutex();
      const release1 = await mutex.obtain();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(mutex.obtain());
      }

      await Promise.resolve();
      expect(mutex.waitingCount).toBe(5);
      expect(mutex.isLocked).toBe(true);

      release1();

      for (const promise of promises) {
        const release = await promise;
        expect(mutex.isLocked).toBe(true);
        release();
      }

      await Promise.resolve();
      expect(mutex.waitingCount).toBe(0);
      expect(mutex.isLocked).toBe(false);
    });
  });
});

describe('mutex-rw', { timeout: 10000 }, () => {
  it.concurrent('never allows readonly and read-write accessors interfere', async () => {
    const mutex = new MutexRW();
    let cntROAccess = 0;
    let cntRWAccess = 0;
    const fRO = async () => {
      const release = await mutex.obtainRead();
      ++cntROAccess;
      expect(cntRWAccess).toBe(0);
      await timeout(Math.random() * 10);
      --cntROAccess;
      try {
        if (Math.random() > 0.5) throw new Error();
      } finally {
        release();
      }
    };
    const fRW = async () => {
      const release = await mutex.obtainWrite();
      expect(++cntRWAccess).toBe(1);
      expect(cntROAccess).toBe(0);
      await timeout(Math.random() * 10);
      --cntRWAccess;
      try {
        if (Math.random() > 0.5) throw new Error();
      } finally {
        release();
      }
    };
    const threads: Promise<unknown>[] = [];
    for (let i = 0; i < 100; ++i) {
      threads.push(Math.random() > 0.5 ? fRO() : fRW());
    }
    await Promise.allSettled(threads);
    expect(cntROAccess).toBe(0);
    expect(cntRWAccess).toBe(0);
  });

  it.concurrent('never allows readonly and read-write accessors interfere, with automatic disposal', async () => {
    const mutex = new MutexRW();
    let cntROAccess = 0;
    let cntRWAccess = 0;
    const fRO = async () => {
      using _ = await mutex.lockRead();
      ++cntROAccess;
      expect(cntRWAccess).toBe(0);
      await timeout(Math.random() * 10);
      --cntROAccess;
      if (Math.random() > 0.5) throw new Error();
    };
    const fRW = async () => {
      using _ = await mutex.lockWrite();
      expect(++cntRWAccess).toBe(1);
      expect(cntROAccess).toBe(0);
      await timeout(Math.random() * 10);
      --cntRWAccess;
      if (Math.random() > 0.5) throw new Error();
    };
    const threads: Promise<unknown>[] = [];
    for (let i = 0; i < 100; ++i) {
      threads.push(Math.random() > 0.5 ? fRO() : fRW());
    }
    await Promise.allSettled(threads);
    expect(cntROAccess).toBe(0);
    expect(cntRWAccess).toBe(0);
  });

  describe('read lock status properties', () => {
    describe('readWaitingCount', () => {
      it('returns 0 when unlocked', () => {
        const mutex = new MutexRW();
        expect(mutex.readWaitingCount).toBe(0);
      });

      it('returns 0 when read lock is held but no waiters', async () => {
        const mutex = new MutexRW();
        const release = await mutex.obtainRead();
        expect(mutex.readWaitingCount).toBe(0);
        release();
      });

      it('increases when reads wait for write', async () => {
        const mutex = new MutexRW();
        const writeRelease = await mutex.obtainWrite();

        const readPromise1 = mutex.obtainRead();
        const readPromise2 = mutex.obtainRead();

        await Promise.resolve();
        expect(mutex.readWaitingCount).toBe(2);

        writeRelease();

        const release1 = await readPromise1;
        const release2 = await readPromise2;

        await Promise.resolve();
        expect(mutex.readWaitingCount).toBe(0);

        release1();
        release2();
      });
    });

    describe('isReadLocked', () => {
      it('is false when no reads held', () => {
        const mutex = new MutexRW();
        expect(mutex.isReadLocked).toBe(false);
      });

      it('is true when reads are held', async () => {
        const mutex = new MutexRW();

        const release = await mutex.obtainRead();
        expect(mutex.isReadLocked).toBe(true);

        release();
        await Promise.resolve();
        expect(mutex.isReadLocked).toBe(false);
      });

      it('is true with multiple concurrent readers', async () => {
        const mutex = new MutexRW();

        const release1 = await mutex.obtainRead();
        expect(mutex.isReadLocked).toBe(true);

        const release2 = await mutex.obtainRead();
        expect(mutex.isReadLocked).toBe(true);

        release1();
        await Promise.resolve();
        expect(mutex.isReadLocked).toBe(true); // Still one reader

        release2();
        await Promise.resolve();
        expect(mutex.isReadLocked).toBe(false);
      });

      it('is false when reads are waiting but not held', async () => {
        const mutex = new MutexRW();
        const writeRelease = await mutex.obtainWrite();

        const readPromise = mutex.obtainRead();
        await Promise.resolve();

        expect(mutex.isReadLocked).toBe(false); // Waiting, not held
        expect(mutex.readWaitingCount).toBe(1);

        writeRelease();
        const readRelease = await readPromise;

        await Promise.resolve();
        expect(mutex.isReadLocked).toBe(true); // Now held

        readRelease();
      });
    });

    describe('activeReadCount', () => {
      it('tracks concurrent readers', async () => {
        const mutex = new MutexRW();
        expect(mutex.activeReadCount).toBe(0);

        const release1 = await mutex.obtainRead();
        expect(mutex.activeReadCount).toBe(1);

        const release2 = await mutex.obtainRead();
        expect(mutex.activeReadCount).toBe(2);

        const release3 = await mutex.obtainRead();
        expect(mutex.activeReadCount).toBe(3);

        release1();
        await Promise.resolve();
        expect(mutex.activeReadCount).toBe(2);

        release2();
        await Promise.resolve();
        expect(mutex.activeReadCount).toBe(1);

        release3();
        await Promise.resolve();
        expect(mutex.activeReadCount).toBe(0);
      });
    });
  });

  describe('write lock status properties', () => {
    describe('writeWaitingCount', () => {
      it('returns 0 when unlocked', () => {
        const mutex = new MutexRW();
        expect(mutex.writeWaitingCount).toBe(0);
      });

      it('returns 0 when write lock is held but no waiters', async () => {
        const mutex = new MutexRW();
        const release = await mutex.obtainWrite();
        expect(mutex.writeWaitingCount).toBe(0);
        release();
      });

      it('increases when writes queue', async () => {
        const mutex = new MutexRW();
        const release1 = await mutex.obtainWrite();

        const promise2 = mutex.obtainWrite();
        const promise3 = mutex.obtainWrite();

        await Promise.resolve();
        expect(mutex.writeWaitingCount).toBe(2);

        release1();
        const release2 = await promise2;

        await Promise.resolve();
        expect(mutex.writeWaitingCount).toBe(1);

        release2();
        const release3 = await promise3;

        await Promise.resolve();
        expect(mutex.writeWaitingCount).toBe(0);

        release3();
      });

      it('increases when writes wait for reads', async () => {
        const mutex = new MutexRW();
        const readRelease = await mutex.obtainRead();

        const writePromise = mutex.obtainWrite();
        await Promise.resolve();

        expect(mutex.writeWaitingCount).toBe(1);

        readRelease();
        const writeRelease = await writePromise;

        await Promise.resolve();
        expect(mutex.writeWaitingCount).toBe(0);

        writeRelease();
      });
    });

    describe('isWriteLocked', () => {
      it('is false when no write held', () => {
        const mutex = new MutexRW();
        expect(mutex.isWriteLocked).toBe(false);
      });

      it('is true when write lock is held', async () => {
        const mutex = new MutexRW();

        const release = await mutex.obtainWrite();
        expect(mutex.isWriteLocked).toBe(true);

        release();
        await Promise.resolve();
        expect(mutex.isWriteLocked).toBe(false);
      });

      it('is false when only read locks are held', async () => {
        const mutex = new MutexRW();
        const release1 = await mutex.obtainRead();
        const release2 = await mutex.obtainRead();

        expect(mutex.isWriteLocked).toBe(false);
        expect(mutex.isReadLocked).toBe(true);

        release1();
        release2();
      });
    });
  });

  describe('combined status scenarios', () => {
    it('tracks complex read-write interactions', async () => {
      const mutex = new MutexRW();

      // Initial state
      expect(mutex.activeReadCount).toBe(0);
      expect(mutex.isWriteLocked).toBe(false);
      expect(mutex.isReadLocked).toBe(false);
      expect(mutex.readWaitingCount).toBe(0);
      expect(mutex.writeWaitingCount).toBe(0);

      // Add readers
      const read1 = await mutex.obtainRead();
      const read2 = await mutex.obtainRead();
      expect(mutex.activeReadCount).toBe(2);
      expect(mutex.isReadLocked).toBe(true);
      expect(mutex.isWriteLocked).toBe(false);

      // Queue a writer (will wait for readers)
      const writePromise = mutex.obtainWrite();
      await Promise.resolve();
      expect(mutex.writeWaitingCount).toBe(1);

      // Queue another reader (will wait for writer)
      const readPromise = mutex.obtainRead();
      await Promise.resolve();
      expect(mutex.readWaitingCount).toBe(1);

      // Release readers, writer should proceed
      read1();
      read2();
      const writeRelease = await writePromise;

      await Promise.resolve();
      expect(mutex.activeReadCount).toBe(0);
      expect(mutex.isReadLocked).toBe(false);
      expect(mutex.isWriteLocked).toBe(true);
      expect(mutex.writeWaitingCount).toBe(0);
      expect(mutex.readWaitingCount).toBe(1);

      // Release writer, reader should proceed
      writeRelease();
      const read3 = await readPromise;

      await Promise.resolve();
      expect(mutex.activeReadCount).toBe(1);
      expect(mutex.isReadLocked).toBe(true);
      expect(mutex.isWriteLocked).toBe(false);
      expect(mutex.readWaitingCount).toBe(0);

      read3();
    });

    it('works correctly with using syntax', async () => {
      const mutex = new MutexRW();

      {
        using _ = await mutex.lockRead();
        expect(mutex.activeReadCount).toBe(1);
        expect(mutex.isReadLocked).toBe(true);
        expect(mutex.isWriteLocked).toBe(false);
      }

      await Promise.resolve();
      expect(mutex.activeReadCount).toBe(0);
      expect(mutex.isReadLocked).toBe(false);

      {
        using _ = await mutex.lockWrite();
        expect(mutex.activeReadCount).toBe(0);
        expect(mutex.isReadLocked).toBe(false);
        expect(mutex.isWriteLocked).toBe(true);
      }

      await Promise.resolve();
      expect(mutex.isWriteLocked).toBe(false);
    });

    it('handles multiple concurrent reads with status tracking', async () => {
      const mutex = new MutexRW();
      const releases = [];

      for (let i = 0; i < 5; i++) {
        const release = await mutex.obtainRead();
        releases.push(release);
        expect(mutex.activeReadCount).toBe(i + 1);
        expect(mutex.isReadLocked).toBe(true);
      }

      expect(mutex.activeReadCount).toBe(5);
      expect(mutex.isReadLocked).toBe(true);
      expect(mutex.isWriteLocked).toBe(false);

      for (let i = 0; i < 5; i++) {
        releases[i]();
        await Promise.resolve();
        expect(mutex.activeReadCount).toBe(4 - i);
        expect(mutex.isReadLocked).toBe(i < 4);
      }
    });

    it('demonstrates writer starvation prevention', async () => {
      const mutex = new MutexRW();

      // Hold a read lock
      const read1 = await mutex.obtainRead();
      expect(mutex.isReadLocked).toBe(true);

      // Queue a writer
      const writePromise = mutex.obtainWrite();
      await Promise.resolve();
      expect(mutex.writeWaitingCount).toBe(1);
      expect(mutex.isWriteLocked).toBe(false); // Not held yet, just waiting

      // New readers should wait for the writer
      const read2Promise = mutex.obtainRead();
      await Promise.resolve();
      expect(mutex.readWaitingCount).toBe(1);

      // Release first reader, writer gets priority
      read1();
      const writeRelease = await writePromise;

      await Promise.resolve();
      expect(mutex.isWriteLocked).toBe(true);
      expect(mutex.isReadLocked).toBe(false);
      expect(mutex.activeReadCount).toBe(0);

      // Release writer, queued reader proceeds
      writeRelease();
      const read2 = await read2Promise;

      await Promise.resolve();
      expect(mutex.activeReadCount).toBe(1);
      expect(mutex.isReadLocked).toBe(true);
      expect(mutex.isWriteLocked).toBe(false);

      read2();
    });
  });
});
