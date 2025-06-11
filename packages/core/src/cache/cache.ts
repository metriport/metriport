export interface Cache<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<T>;
  del(key: string): Promise<void>;
}
