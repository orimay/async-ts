# async-ts

Lightweight TypeScript utilities for asynchronous concurrency control and task scheduling. Zero
dependencies.

- **Synchronization**: `Mutex`, `MutexRW` (read-write lock), `Latch`, `PromiseBarrier`
- **Task scheduling**: `timeout`, `macrotask`, `microtask`, `animationFrame`
- **Async iteration**: `filter`, `pSome`, `pEvery`, `pNone`, `first`
- **Modern syntax**: Disposable locks via `using` for automatic release

## Installation

```bash
npm install async-ts
```

## Mutex

Exclusive lock preventing race conditions in critical sections.

```typescript
import { Mutex } from 'async-ts';

const mutex = new Mutex();

// Recommended: using syntax (auto-release)
{
  using _ = await mutex.lock();
  await updateSharedResource();
}

// Manual: obtain/release
const release = await mutex.obtain();
try {
  await updateSharedResource();
} finally {
  release();
}

// Conditional bypass
{
  using _ = await mutex.lock(shouldBypass);
}

// Monitor contention
console.log(mutex.isLocked); // boolean
console.log(mutex.waitingCount); // number
```

## MutexRW

Read-write lock allowing multiple concurrent readers but exclusive writers. Prevents writer
starvation.

```typescript
import { MutexRW } from 'async-ts';

const lock = new MutexRW();

// Read (concurrent)
{
  using _ = await lock.lockRead();
  const data = await readData();
}

// Write (exclusive)
{
  using _ = await lock.lockWrite();
  await writeData(newData);
}

// Monitor status
console.log(lock.activeReadCount); // number
console.log(lock.readWaitingCount); // number
console.log(lock.writeWaitingCount); // number
console.log(lock.isReadLocked); // boolean
console.log(lock.isWriteLocked); // boolean
```

## Latch

Gate for coordinating asynchronous flows.

```typescript
import { Latch } from 'async-ts';

const latch = new Latch(); // starts closed

// Wait in one place
await latch.gate;

// Open from another
latch.open();

// Reset
latch.close();

// Usage counting with disposable
{
  using _ = latch.use(() => someCondition);
  // Latch stays closed during scope
} // Opens when all uses disposed and condition met
```

## PromiseBarrier

Track and await multiple promises.

```typescript
import { PromiseBarrier } from 'async-ts';

const barrier = new PromiseBarrier();
barrier.add(fetch('/api/a'));
barrier.add(fetch('/api/b'));
await barrier.free; // resolves when all settle
```

## Task Scheduling

```typescript
import { timeout, macrotask, microtask, animationFrame } from 'async-ts';

await timeout(1000); // delay ms
await macrotask(); // next event loop turn
await microtask(); // microtask queue (higher priority)
const time = await animationFrame(); // next repaint (browser-only)
```

## Async Iteration

```typescript
import { filter, pSome, pEvery, pNone, first } from 'async-ts';

// Async filter (concurrent via Promise.all)
const evens = await filter([1, 2, 3, 4], async n => n % 2 === 0); // [2, 4]

// Async predicates (sequential, short-circuit)
await pSome([1, 2, 3], async n => n > 2); // true
await pEvery([2, 4, 6], async n => n % 2 === 0); // true
await pNone([1, 3, 5], async n => n % 2 === 0); // true

// First value from async generator
async function* gen() {
  yield 1;
  yield 2;
}
await first(gen()); // 1
```

## API Reference

### Mutex

| Member         | Description                            |
| -------------- | -------------------------------------- |
| `obtain()`     | Acquire lock, returns release function |
| `lock()`       | Acquire lock, returns disposable       |
| `isLocked`     | Whether mutex is currently held        |
| `waitingCount` | Number of tasks waiting to acquire     |

### MutexRW

| Member              | Description                            |
| ------------------- | -------------------------------------- |
| `obtainRead()`      | Acquire read lock, returns release fn  |
| `obtainWrite()`     | Acquire write lock, returns release fn |
| `lockRead()`        | Acquire read lock, returns disposable  |
| `lockWrite()`       | Acquire write lock, returns disposable |
| `activeReadCount`   | Number of active readers               |
| `readWaitingCount`  | Tasks waiting for read lock            |
| `writeWaitingCount` | Tasks waiting for write lock           |
| `isReadLocked`      | Whether read locks are held            |
| `isWriteLocked`     | Whether write lock is held             |

### Latch

| Member    | Description                                 |
| --------- | ------------------------------------------- |
| `gate`    | Promise that resolves when latch is open    |
| `open()`  | Release all waiters                         |
| `close()` | Reset to closed state                       |
| `use()`   | Returns disposable for usage-counted gating |

### PromiseBarrier

| Member  | Description                               |
| ------- | ----------------------------------------- |
| `add()` | Track a promise                           |
| `free`  | Promise resolving when all tracked settle |

## Notes

- Prefer `using` syntax over manual `obtain()`/`release()` to prevent leaks.
- `animationFrame` requires a browser environment.
- The disposable pattern uses `Symbol.dispose` — ensure your tsconfig includes
  `"lib": ["esnext.disposable"]`.

## License

MIT
