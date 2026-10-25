/**
 * Kichik LRU kesh: sig'imdan oshganda eng uzoq ishlatilmagan yozuv chiqariladi va `onEvict`
 * chaqiriladi (masalan, canvas xotirasini bo'shatish uchun).
 */
export class LruCache<K, V> {
  private readonly items = new Map<K, V>();

  constructor(
    private readonly capacity: number,
    private readonly onEvict?: (value: V, key: K) => void,
  ) {}

  get size() {
    return this.items.size;
  }

  has(key: K) {
    return this.items.has(key);
  }

  /** O'qilgan yozuv "yangi" bo'ladi. */
  get(key: K): V | undefined {
    const value = this.items.get(key);
    if (value === undefined) return undefined;
    this.items.delete(key);
    this.items.set(key, value);
    return value;
  }

  set(key: K, value: V) {
    const previous = this.items.get(key);
    if (previous !== undefined) {
      this.items.delete(key);
      if (previous !== value) this.onEvict?.(previous, key);
    }
    this.items.set(key, value);
    while (this.items.size > this.capacity) {
      const [oldestKey, oldest] = this.items.entries().next().value as [K, V];
      this.items.delete(oldestKey);
      this.onEvict?.(oldest, oldestKey);
    }
  }

  /** Shart bo'yicha birinchi mos yozuv (eng yangisidan), "yangilamasdan". */
  find(predicate: (value: V, key: K) => boolean): V | undefined {
    for (const [key, value] of [...this.items.entries()].reverse()) {
      if (predicate(value, key)) return value;
    }
    return undefined;
  }

  clear() {
    for (const [key, value] of this.items) this.onEvict?.(value, key);
    this.items.clear();
  }
}
