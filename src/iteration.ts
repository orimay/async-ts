/**
 * Filters elements of the input array asynchronously based on the provided predicate function.
 * This function is ideal for scenarios where the filtering condition involves asynchronous operations,
 * such as API calls, database queries, or I/O-bound checks. It processes all predicates concurrently
 * using Promise.all for efficiency, making it suitable for large arrays or time-consuming predicates.
 * Returns a new array preserving the original order of elements that pass the test.
 *
 * @param arr - The input array to filter. Can be empty; returns empty array if so.
 * @param predicate - An asynchronous function that tests each element. Should return a promise resolving to boolean.
 * @returns A promise resolving to a new array with elements that passed the predicate.
 * @template T - The type of the elements in the input array.
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * async function isEven(num: number): Promise<boolean> {
 *   await timeout(100); // Simulate async check
 *   return num % 2 === 0;
 * }
 * const result = await filter(arr, isEven);
 * console.log(result); // [2, 4]
 * ```
 */
export async function filter<T>(
  arr: T[],
  predicate: (value: T) => Promise<boolean>,
) {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_v, index) => results[index]);
}

/**
 * Takes an iterable iterator and checks if any of its elements satisfy the provided predicate function.
 * Function pSome<T> runs asynchronously.
 * This is useful for short-circuiting checks in iterables where finding at least one match is sufficient,
 * such as validating user inputs, searching datasets, or conditional branching in async pipelines.
 * Iterates sequentially to allow early exit on first true, minimizing unnecessary computations.
 *
 * @param iter - The iterable object to check (e.g., array, set, map values). Handles sync and async iterables.
 * @param pred - Asynchronous predicate function that returns true if the element satisfies the condition.
 * @returns A promise resolving to true if at least one element passes; false otherwise.
 * @template T - The type of items in the iterable object.
 * @example
 * ```typescript
 * const iter = [1, 2, 3, 4, 5];
 * async function isEven(num: number): Promise<boolean> {
 *   return num % 2 === 0;
 * }
 * const result = await pSome(iter, isEven);
 * console.log(result); // true
 * ```
 */
export async function pSome<T>(
  iter: Iterable<T>,
  pred: (value: T) => Promise<boolean>,
) {
  for (const value of iter) {
    if (await pred(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Asynchronously checks if none of the elements from the provided iterable iterator pass the provided predicate function.
 * This function is the negation of pSome, useful for ensuring no invalid items exist in a collection,
 * such as validation loops, security checks, or asserting invariants in async data processing.
 * Short-circuits on the first true predicate to return false early.
 *
 * @param iter - The iterable to check. Returns true if empty.
 * @param pred - Asynchronous predicate that should return false for all elements to pass.
 * @returns A promise resolving to true if no elements pass the predicate; false if any do.
 * @template T - The type of items in the iterable object.
 * @example
 * ```typescript
 * const iter = [1, 3, 5]; // All odd
 * async function isEven(num: number): Promise<boolean> {
 *   return num % 2 === 0;
 * }
 * const result = await pNone(iter, isEven);
 * console.log(result); // true
 * ```
 */
export async function pNone<T>(
  iter: Iterable<T>,
  pred: (value: T) => Promise<boolean>,
) {
  for (const value of iter) {
    if (await pred(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Takes an iterable iterator and checks every element with the provided predicate function.
 * Function pEvery<T> runs asynchronously.
 * Essential for full validation of collections, like ensuring all API responses meet criteria,
 * batch processing checks, or compliance verification in async workflows.
 * Short-circuits on the first false to return false early, optimizing for failure cases.
 *
 * @param iter - The iterable to validate. Returns true if empty (vacuous truth).
 * @param pred - Asynchronous predicate that must return true for every element.
 * @returns A promise resolving to true if all elements pass; false otherwise.
 * @template T - The type of items in the iterable object.
 * @example
 * ```typescript
 * const iter = [2, 4, 6];
 * async function isEven(num: number): Promise<boolean> {
 *   return num % 2 === 0;
 * }
 * const result = await pEvery(iter, isEven);
 * console.log(result); // true
 * ```
 */
export async function pEvery<T>(
  iter: Iterable<T>,
  pred: (value: T) => Promise<boolean>,
) {
  for (const value of iter) {
    if (!(await pred(value))) {
      return false;
    }
  }
  return true;
}

/**
 * Retrieves the first value from an asynchronous generator. After extraction, the generator is closed.
 * This utility is perfect for scenarios where only the initial yield is needed, such as lazy loading,
 * streaming data processing, or interfacing with async iterables in APIs like ReadableStreams.
 * Safely closes the generator via return() to free resources, even on errors.
 *
 * @param gen - The async generator to extract from. Can be empty; returns undefined.
 * @returns A promise resolving to the first yielded value or undefined if none.
 * @template T - The type of items yielded by the generator.
 * @example
 * ```typescript
 * async function* asyncGen() {
 *   yield 1;
 *   yield 2; // Never reached
 * }
 * const result = await first(asyncGen());
 * console.log(result); // 1
 * ```
 */
export async function first<T>(gen: AsyncGenerator<T>) {
  try {
    return (await gen.next()).value as T | undefined;
  } finally {
    await gen.return(undefined);
  }
}
