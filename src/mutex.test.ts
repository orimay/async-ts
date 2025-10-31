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

  it.concurrent(
    'never allows accessors interfere, with automatic disposal',
    async () => {
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
    },
  );
});

describe('mutex-rw', { timeout: 10000 }, () => {
  it.concurrent(
    'never allows readonly and read-write accessors interfere',
    async () => {
      const mutex = new MutexRW();
      let cntROAccess = 0;
      let cntRWAccess = 0;
      const fRO = async () => {
        const release = await mutex.obtainRO();
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
        const release = await mutex.obtainRW();
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
    },
  );

  it.concurrent(
    'never allows readonly and read-write accessors interfere, with automatic disposal',
    async () => {
      const mutex = new MutexRW();
      let cntROAccess = 0;
      let cntRWAccess = 0;
      const fRO = async () => {
        using _ = await mutex.lockRO();
        ++cntROAccess;
        expect(cntRWAccess).toBe(0);
        await timeout(Math.random() * 10);
        --cntROAccess;
        if (Math.random() > 0.5) throw new Error();
      };
      const fRW = async () => {
        using _ = await mutex.lockRW();
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
    },
  );
});
