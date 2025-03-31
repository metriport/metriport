import { Cache } from "./cache";

type CacheEntry<T> = {
  value: T;
  timestamp: number;
};

export class InMemoryCache<T> implements Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();

  constructor(
    private readonly expirationTime: number,
    private readonly getNewValue: ({ age }: { age: number }) => Promise<T | undefined>
  ) {}

  async get(key: string): Promise<T | undefined> {
    const now = Date.now();
    const entry = this.cache.get(key);
    const age = now - (entry?.timestamp ?? -1);
    if (entry && age < this.expirationTime) {
      return entry.value;
    }
    const newValue = await this.getNewValue({ age });
    if (!newValue) return undefined;

    this.cache.set(key, { value: newValue, timestamp: now });
    return newValue;
  }

  async set(key: string, value: T): Promise<T> {
    this.cache.set(key, { value, timestamp: Date.now() });
    return value;
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
}
