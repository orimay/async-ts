# async-ts

A comprehensive TypeScript library for advanced asynchronous programming and
concurrency control. `async-ts` provides a suite of utilities to manage
promises, schedule tasks, and synchronize access in JavaScript environments.
Whether you're building high-performance servers, interactive web apps, or
complex workflows, this package offers robust primitives like mutexes,
read-write locks, promise barriers, latches, and task schedulers (microtasks,
macrotasks, animation frames) to handle concurrency safely and efficiently.

Key features include:

- **Promise Management**: Track and await batches of promises with
  `PromiseBarrier`.
- **Synchronization Primitives**: Simple `Mutex` for exclusive access, `MutexRW`
  for optimized read-write scenarios, and `Latch` for gating asynchronous flows.
- **Async Iteration Utilities**: Asynchronous filtering with `filter`, predicate
  checks like `pSome`, `pEvery`, `pNone`, and extracting from async generators
  with `first`.
- **Task Scheduling**: Defer execution with microtasks, macrotasks, or animation
  frames for optimal performance in browsers or Node.js.
- **Modern Syntax Support**: Disposable locks compatible with the `using`
  statement for automatic resource management, reducing boilerplate and errors.
- **Lightweight & Performant**: No external dependencies, promise-based API for
  seamless integration into async/await code.
- **Cross-Environment**: Works in browsers (with fallbacks for non-supported
  features) and Node.js, ideal for full-stack development.

This library is designed for developers dealing with concurrent operations, such
as API orchestration, caching layers, real-time systems, or animation-heavy UIs.
It helps prevent race conditions, manage resource contention, and optimize
execution timing, leading to more reliable and efficient applications.

> **Note:** Feature `animationFrame` requires a browser environment. The
> disposable pattern (`[Symbol.dispose]`) leverages modern TypeScript/ES
> features—ensure your config includes `"lib": ["esnext", "esnext.disposable"]`
> or use polyfills.

## Installation

Install via your favorite package manager:

```bash
npm install async-ts
# or
yarn add async-ts
# or
pnpm add async-ts
# or
bun add async-ts
```

## Usage

Import the utilities you need and integrate them into your async code. Below are
detailed examples for each public API.

### Task Scheduling Utilities

These functions help control when your code executes in the event loop.

1. **timeout(ms)**

   Delays execution for a specified time.

   ```typescript
   import { timeout } from 'async-ts';

   await timeout(1000); // Wait 1 second
   console.log('Executed after delay');
   ```

2. **macrotask()**

   Defers to the next event loop turn.

   ```typescript
   import { macrotask } from 'async-ts';

   await macrotask();
   // Runs after current macrotasks
   ```

3. **microtask()**

   Executes in the next microtask.

   ```typescript
   import { microtask } from 'async-ts';

   microtask().then(() => console.log('Microtask'));
   ```

4. **animationFrame()**

   Syncs with the next browser repaint (browser-only).

   ```typescript
   import { animationFrame } from 'async-ts';

   const time = await animationFrame();
   console.log(`Frame timestamp: ${time}`);
   ```

### Async Iteration Utilities

These functions extend async/await to common iteration patterns with
asynchronous predicates.

1. **filter(arr, predicate)**

   Asynchronously filters an array.

   ```typescript
   import { filter } from 'async-ts';

   const arr = [1, 2, 3, 4, 5];
   async function isEven(num: number) {
     return num % 2 === 0;
   }
   const result = await filter(arr, isEven);
   console.log(result); // [2, 4]
   ```

2. **pSome(iter, pred)**

   Checks if any element satisfies the async predicate.

   ```typescript
   import { pSome } from 'async-ts';

   const iter = [1, 2, 3];
   async function isEven(num: number) {
     return num % 2 === 0;
   }
   const result = await pSome(iter, isEven);
   console.log(result); // true
   ```

3. **pNone(iter, pred)**

   Checks if no elements satisfy the async predicate.

   ```typescript
   import { pNone } from 'async-ts';

   const iter = [1, 3, 5];
   async function isEven(num: number) {
     return num % 2 === 0;
   }
   const result = await pNone(iter, isEven);
   console.log(result); // true
   ```

4. **pEvery(iter, pred)**

   Checks if all elements satisfy the async predicate.

   ```typescript
   import { pEvery } from 'async-ts';

   const iter = [2, 4, 6];
   async function isEven(num: number) {
     return num % 2 === 0;
   }
   const result = await pEvery(iter, isEven);
   console.log(result); // true
   ```

5. **first(gen)**

   Extracts the first value from an async generator and closes it.

   ```typescript
   import { first } from 'async-ts';

   async function* asyncGen() {
     yield 1;
     yield 2;
   }
   const result = await first(asyncGen());
   console.log(result); // 1
   ```

### PromiseBarrier

Manage and await multiple promises.

#### Manual Tracking

```typescript
import { PromiseBarrier } from 'async-ts';

const barrier = new PromiseBarrier();
barrier.add(fetch('/api1'));
barrier.add(fetch('/api2'));
await barrier.free; // Waits for both to settle
barrier.add(fetch('/api3'));
await barrier.free; // Waits for all three to settle
```

### Mutex

Simple exclusive lock for preventing race conditions in critical sections.

#### Status Properties

```typescript
import { Mutex } from 'async-ts';

const mutex = new Mutex();

// Check lock status
console.log(mutex.isLocked); // false
console.log(mutex.waitingCount); // 0

const release = await mutex.obtain();
console.log(mutex.isLocked); // true
console.log(mutex.waitingCount); // 0 (no one waiting yet)

// Another task waiting
const promise = mutex.obtain();
console.log(mutex.waitingCount); // 1

release();
```

#### Manual Lock Management

```typescript
import { Mutex } from 'async-ts';

const mutex = new Mutex();
const release = await mutex.obtain();

try {
  // Critical section
  await updateSharedResource();
} finally {
  release();
}
```

#### With Bypass (Conditional Locking)

```typescript
const shouldBypass = checkCondition(); // Runtime condition
const release = await mutex.obtain(shouldBypass);
try {
  // Optional critical section
  await maybeUpdateResource();
} finally {
  release();
}
```

#### Using Disposable Locks with `using` (Recommended)

```typescript
import { Mutex } from 'async-ts';

const mutex = new Mutex();

{
  using _ = await mutex.lock();
  // Critical section, automatically released when scope exits
  await updateSharedResource();
}
```

#### With Bypass

```typescript
{
  using _ = await mutex.lock(shouldBypass);
  // Conditional critical section
}
```

#### Monitoring Lock Contention

```typescript
const mutex = new Mutex();

// Performance monitoring
setInterval(() => {
  if (mutex.waitingCount > 10) {
    console.warn(`High lock contention: ${mutex.waitingCount} tasks waiting`);
    // Consider scaling or load balancing
  }
}, 1000);

// Adaptive behavior
async function smartOperation() {
  if (mutex.waitingCount > 5) {
    // Too much contention, try alternative approach
    await useCache();
  } else {
    using _ = await mutex.lock();
    await updateDatabase();
  }
}
```

### MutexRW

Read-write lock for optimized concurrent access. Allows multiple simultaneous
readers but exclusive writers.

#### Status Properties

```typescript
import { MutexRW } from 'async-ts';

const mutexRW = new MutexRW();

// Read lock status
console.log(mutexRW.readWaitingCount); // Tasks waiting for read lock
console.log(mutexRW.activeReadCount); // Tasks currently reading
console.log(mutexRW.isReadLocked); // Whether read locks are held

// Write lock status
console.log(mutexRW.writeWaitingCount); // Tasks waiting for write lock
console.log(mutexRW.isWriteLocked); // Whether write lock is held
```

#### Manual Lock Management

```typescript
import { MutexRW } from 'async-ts';

const mutexRW = new MutexRW();

// Read operation
const releaseRead = await mutexRW.obtainRead();
try {
  // Multiple readers can access simultaneously
  const data = await readFromCache();
  console.log(`Active readers: ${mutexRW.activeReadCount}`);
} finally {
  releaseRead();
}

// Write operation
const releaseWrite = await mutexRW.obtainWrite();
try {
  // Exclusive access - no readers or other writers
  await writeToCache(newData);
  console.log(`Write lock held: ${mutexRW.isWriteLocked}`); // true
} finally {
  releaseWrite();
}
```

#### Using Disposable Locks with `using` (Recommended)

```typescript
{
  using _ = await mutexRW.lockRead();
  // Read section, automatically released
  const data = await readData();
}

{
  using _ = await mutexRW.lockWrite();
  // Write section, automatically released
  await writeData(newData);
}
```

#### Real-World Cache Example

```typescript
import { MutexRW } from 'async-ts';

class Cache<K, V> {
  private data = new Map<K, V>();
  private lock = new MutexRW();

  async get(key: K): Promise<V | undefined> {
    using _ = await this.lock.lockRead();
    return this.data.get(key);
  }

  async set(key: K, value: V): Promise<void> {
    using _ = await this.lock.lockWrite();
    this.data.set(key, value);
  }

  async batchRead(keys: K[]): Promise<Map<K, V>> {
    using _ = await this.lock.lockRead();
    const result = new Map<K, V>();
    for (const key of keys) {
      const value = this.data.get(key);
      if (value !== undefined) result.set(key, value);
    }
    return result;
  }

  async clear(): Promise<void> {
    using _ = await this.lock.lockWrite();
    this.data.clear();
  }

  // Monitor cache performance
  getStats() {
    return {
      activeReaders: this.lock.activeReadCount,
      readWaiters: this.lock.readWaitingCount,
      writeWaiters: this.lock.writeWaitingCount,
      isReadLocked: this.lock.isReadLocked,
      isWriteLocked: this.lock.isWriteLocked,
    };
  }
}
```

#### Performance Monitoring

```typescript
const mutexRW = new MutexRW();

// Comprehensive status check
function logLockStatus() {
  console.log('Lock Status:', {
    activeReaders: mutexRW.activeReadCount,
    readWaiters: mutexRW.readWaitingCount,
    writeWaiters: mutexRW.writeWaitingCount,
    isReadLocked: mutexRW.isReadLocked,
    isWriteLocked: mutexRW.isWriteLocked,
  });
}

// Adaptive behavior based on contention
async function smartRead() {
  if (mutexRW.readWaitingCount > 20) {
    // Too many readers waiting (likely writer blocking)
    // Use stale cache or alternative source
    return await getStaleData();
  }

  using _ = await mutexRW.lockRead();
  return await readFreshData();
}

async function smartWrite() {
  if (mutexRW.writeWaitingCount > 5) {
    // Many writers queued, consider batching
    await addToBatch(data);
  } else {
    using _ = await mutexRW.lockWrite();
    await writeImmediately(data);
  }
}
```

#### Writer Starvation Prevention Example

```typescript
// MutexRW prevents writer starvation by ensuring writers
// get priority over new readers once a writer is queued

const mutexRW = new MutexRW();

// Reader 1 acquires lock
const read1 = await mutexRW.obtainRead();
console.log(mutexRW.isReadLocked); // true

// Writer queues (will wait for reader 1)
const writePromise = mutexRW.obtainWrite();
console.log(mutexRW.writeWaitingCount); // 1 (waiting)
console.log(mutexRW.isWriteLocked); // false (not held yet)

// Reader 2 tries to acquire - will wait for writer!
const read2Promise = mutexRW.obtainRead();
console.log(mutexRW.readWaitingCount); // 1 (waiting)

// Release reader 1 - writer gets priority
read1();
const writeRelease = await writePromise;

console.log(mutexRW.isWriteLocked); // true (now held)
console.log(mutexRW.isReadLocked); // false
console.log(mutexRW.activeReadCount); // 0

// Writer completes - reader 2 can now proceed
writeRelease();
const read2 = await read2Promise;
console.log(mutexRW.isReadLocked); // true
console.log(mutexRW.activeReadCount); // 1
read2();
```

#### Backward Compatibility

The old API is still supported for backward compatibility:

```typescript
// Old API (deprecated but still works)
const releaseRO = await mutexRW.obtainRO();
const releaseRW = await mutexRW.obtainRW();

using _ = await mutexRW.lockRO();
using _ = await mutexRW.lockRW();

// New API (recommended)
const releaseRead = await mutexRW.obtainRead();
const releaseWrite = await mutexRW.obtainWrite();

using _ = await mutexRW.lockRead();
using _ = await mutexRW.lockWrite();
```

### Latch

Gate for asynchronous coordination.

#### Basic Usage

```typescript
import { Latch } from 'async-ts';

const latch = new Latch();
// Await in one place
await latch.gate;
// Open in another
latch.open();
```

#### With Usage Counting

```typescript
{
  using _ = latch.use(() => someCondition);
  // Latch closed during scope
} // Opens if conditions met
```

#### Advanced Methods

- `close()`: Reset to closed state.
- `open()`: Release waiters.

## Important Notes

- **Error Handling**: Always use `try...finally` for manual releases to prevent
  leaks or deadlocks.
- **Recommended Pattern**: Prefer `using` syntax for automatic resource
  management when possible.
- **Performance**: These primitives are optimized for async use; avoid in hot
  loops without necessity.
- **Compatibility**: Test in your target environments, especially for
  browser-specific features.
- **Debugging**: Uncomment deadlock detection in `MutexRW` for development.
- **Integration**: Pairs well with libraries like RxJS, Redux-Saga, or Node.js
  clusters for advanced concurrency.
- **Monitoring**: Use status properties (`waitingCount`, `activeReadCount`,
  etc.) to monitor lock contention and optimize performance.

## Common Patterns

### Database Connection Pool

```typescript
import { Mutex } from 'async-ts';

class ConnectionPool {
  private connections: Connection[] = [];
  private lock = new Mutex();

  async acquire(): Promise<Connection> {
    using _ = await this.lock.lock();

    if (this.connections.length === 0) {
      return await this.createConnection();
    }

    return this.connections.pop()!;
  }

  async release(conn: Connection): Promise<void> {
    using _ = await this.lock.lock();
    this.connections.push(conn);
  }

  getStats() {
    return {
      available: this.connections.length,
      waitingForConnection: this.lock.waitingCount,
    };
  }
}
```

### Rate Limiter with Read-Write Lock

```typescript
import { MutexRW } from 'async-ts';

class RateLimiter {
  private tokens: number;
  private lock = new MutexRW();

  constructor(private maxTokens: number) {
    this.tokens = maxTokens;
  }

  async checkAvailable(): Promise<boolean> {
    using _ = await this.lock.lockRead();
    return this.tokens > 0;
  }

  async consume(): Promise<boolean> {
    using _ = await this.lock.lockWrite();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return false;
  }

  async refill(): Promise<void> {
    using _ = await this.lock.lockWrite();
    this.tokens = this.maxTokens;
  }
}
```

## API Reference Summary

### Mutex

- `obtain(bypass?: boolean)`: Acquire lock, returns release function
- `lock(bypass?: boolean)`: Acquire lock, returns disposable
- `waitingCount`: Number of waiting tasks
- `isLocked`: Whether mutex is locked

### MutexRW

- `obtainRead()`: Acquire read lock, returns release function
- `obtainWrite()`: Acquire write lock, returns release function
- `lockRead()`: Acquire read lock, returns disposable
- `lockWrite()`: Acquire write lock, returns disposable
- `readWaitingCount`: Number of tasks waiting for read lock
- `writeWaitingCount`: Number of tasks waiting for write lock
- `activeReadCount`: Number of active readers
- `isReadLocked`: Whether read locks are currently held
- `isWriteLocked`: Whether write lock is currently held
- `obtainRO()`, `obtainRW()`, `lockRO()`, `lockRW()`: Deprecated aliases

For full API details, refer to the JSDoc in the source code.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- Dmitrii Baranov <dmitrii.a.baranov@gmail.com>

## Contributing

Contributions welcome! Open issues/PRs on GitHub for features, bugs, or
improvements.

## Why async-ts?

In a world of increasing concurrency (web workers, async I/O, multi-core),
`async-ts` empowers you to write safer, more efficient code. It's battle-tested
for production use, with a focus on developer experience and performance. Star
the repo and spread the word to help it reach top usage!
