import { describe, expect, it } from 'vitest';
import { PromiseBarrier, timeout } from '.';

async function ensureTimesOut(barrier: PromiseBarrier, timesOut = true) {
  const timedOut = await Promise.race([
    barrier.free.then(() => false),
    timeout(10).then(() => true),
  ]);
  expect(timedOut).toBe(timesOut);
}

describe('promise-barrier', { timeout: 10000 }, () => {
  it.concurrent('resolves free immediately when empty', async () => {
    const barrier = new PromiseBarrier();
    await ensureTimesOut(barrier, false);
  });

  it.concurrent(
    'resolves free immediately with already settled promises',
    async () => {
      const barrier = new PromiseBarrier();
      barrier.add(Promise.resolve());
      barrier.add(Promise.reject(new Error()));
      await ensureTimesOut(barrier, false);
    },
  );

  it.concurrent('waits for pending promises to settle', async () => {
    const barrier = new PromiseBarrier();

    barrier.add(timeout(20));
    barrier.add(timeout(30));

    await ensureTimesOut(barrier);

    await timeout(40);
    await ensureTimesOut(barrier, false);
  });

  it.concurrent('handles dynamic additions during wait', async () => {
    const barrier = new PromiseBarrier();

    barrier.add(timeout(20));
    await ensureTimesOut(barrier);

    barrier.add(timeout(50));

    await timeout(20); // After first resolves, but before second
    await ensureTimesOut(barrier);

    await timeout(30);
    await ensureTimesOut(barrier, false);
  });

  it.concurrent('caches the free promise during wait', async () => {
    const barrier = new PromiseBarrier();

    barrier.add(timeout(20));

    const free1 = barrier.free;
    const free2 = barrier.free;
    expect(free1).toBe(free2); // Same instance

    await timeout(30);
    await ensureTimesOut(barrier, false);
  });

  it.concurrent('handles errors without rejecting free', async () => {
    const barrier = new PromiseBarrier();

    barrier.add(Promise.reject(new Error('Test error')));
    barrier.add(
      new Promise<void>((_, r) =>
        setTimeout(() => {
          r(new Error('Delayed error'));
        }, 20),
      ),
    );

    await timeout(30);
    await ensureTimesOut(barrier, false);
  });
});
