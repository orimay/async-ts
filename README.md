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

Simple exclusive lock.

#### Manual Lock Management

```typescript
import { Mutex } from 'async-ts';

const mutex = new Mutex();
const release = await mutex.obtain();

try {
  // Critical section
} finally {
  release();
}
```

With bypass:

```typescript
const shouldBypass = true; // Runtime condition
const release = await mutex.obtain(shouldBypass);
try {
  // Optional critical section
} finally {
  release();
}
```

#### Using Disposable Locks with `using`

```typescript
import { Mutex } from 'async-ts';

{
  using _ = await mutex.lock();
  // Critical section, auto-released
}
```

With bypass:

```typescript
{
  using _ = await mutex.lock(shouldBypass);
  // Conditional critical section
}
```

### MutexRW

Read-write lock for concurrent reads.

#### Manual Lock Management

```typescript
import { MutexRW } from 'async-ts';

const mutexRW = new MutexRW();
const releaseRO = await mutexRW.obtainRO();
try {
  // Read operation
} finally {
  releaseRO();
}

const releaseRW = await mutexRW.obtainRW();
try {
  // Write operation
} finally {
  releaseRW();
}
```

#### Using Disposable Locks with `using`

```typescript
{
  using _ = await mutexRW.lockRO();
  // Read section, auto-released
}

{
  using _ = await mutexRW.lockRW();
  // Write section, auto-released
}
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
- **Performance**: These primitives are optimized for async use; avoid in hot
  loops without necessity.
- **Compatibility**: Test in your target environments, especially for
  browser-specific features.
- **Debugging**: Uncomment deadlock detection in `MutexRW` for development.
- **Integration**: Pairs well with libraries like RxJS, Redux-Saga, or Node.js
  clusters for advanced concurrency.

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
