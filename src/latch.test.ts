import { describe, expect, it } from 'vitest';
import { Latch, timeout } from '.';

async function ensureTimesOut(latch: Latch, timesOut = true) {
  const timedOut = await Promise.race([
    latch.gate.then(() => false),
    timeout(10).then(() => true),
  ]);
  expect(timedOut).toBe(timesOut);
}

describe('latch', { timeout: 10000 }, () => {
  it.concurrent('waits until opened', async () => {
    const latch = new Latch(); // starts closed
    await ensureTimesOut(latch);

    latch.open();
    await ensureTimesOut(latch, false);
  });

  it.concurrent('handles multiple closes and opens', async () => {
    const latch = new Latch(); // closed

    await ensureTimesOut(latch);

    latch.open();
    await ensureTimesOut(latch, false);

    latch.close();
    await ensureTimesOut(latch);

    latch.open();
    await ensureTimesOut(latch, false);
  });

  it.concurrent('handles state changes during await', async () => {
    const latch = new Latch(); // closed

    // Simulate state change: open and close quickly
    setTimeout(() => {
      latch.open();
      latch.close();
    }, 5);

    // The gate should recurse and wait for the new gate
    await ensureTimesOut(latch);

    latch.open();
    await ensureTimesOut(latch, false);
  });

  it.concurrent('manages usage counting', async () => {
    const latch = new Latch();

    const use1 = latch.use();
    const use2 = latch.use();
    const use3 = latch.use();

    await ensureTimesOut(latch);
    use1[Symbol.dispose]();

    await ensureTimesOut(latch);
    use2[Symbol.dispose]();

    await ensureTimesOut(latch);
    use3[Symbol.dispose]();

    await ensureTimesOut(latch, false);
  });

  it.concurrent('manages usage with condition', async () => {
    const latch = new Latch();

    latch.use(() => false)[Symbol.dispose]();
    await ensureTimesOut(latch); // Should not open because condition is false

    latch.use(() => true)[Symbol.dispose]();
    await ensureTimesOut(latch, false);

    // Test with false condition
    const latch2 = new Latch();

    latch2.use(() => false)[Symbol.dispose]();
    await ensureTimesOut(latch2); // Should not open because condition is false

    latch2.open(); // Manually open to confirm
    await ensureTimesOut(latch2, false);
  });

  it.concurrent('opens all gates', async () => {
    const latch = new Latch();
    const tasks: Promise<void>[] = [];
    let passedLatchCount = 0;

    for (let i = 0; i < 50; ++i) {
      tasks.push(
        (async () => {
          await latch.gate;
          ++passedLatchCount;
          await timeout(Math.random() * 10);
          if (Math.random() > 0.5) throw new Error('Simulated error');
        })(),
      );
    }

    await timeout(20);
    expect(passedLatchCount).toBe(0);

    latch.open();

    await timeout(0);
    expect(passedLatchCount).toBe(50);

    const results = await Promise.allSettled(tasks);
    const fulfilled = results.filter(r => r.status === 'fulfilled').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    expect(fulfilled + rejected).toBe(50);
  });
});
