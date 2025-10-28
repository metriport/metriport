import {
  createSmartCoding,
  createSmartCodeableConcept,
  isCoding,
  isCodeableConcept,
} from "./coding-utilities";

/**
 * Cache for transparent proxy objects to maintain object identity
 */
const transparentProxyCache = new WeakMap<object, object>();

/**
 * Create a transparent proxy that wraps plain objects to intercept property access.
 * This enables deep access to Coding and CodeableConcept objects at any nesting level.
 *
 * Unlike SmartResource proxies, transparent proxies don't add methods - they just
 * intercept property access to wrap Coding/CodeableConcept objects when accessed.
 *
 * @param obj - The plain object to wrap
 * @returns A proxied object that wraps Coding/CodeableConcept on access
 */
export function createTransparentProxy<T extends object>(obj: T): T {
  // Check cache first to maintain object identity
  const cached = transparentProxyCache.get(obj);
  if (cached) {
    return cached as T;
  }

  const proxy = new Proxy(obj, {
    get: (target, prop, receiver) => {
      const value = Reflect.get(target, prop, receiver);

      // Don't wrap null or undefined
      if (value === null || value === undefined) {
        return value;
      }

      // Wrap CodeableConcept objects (check before Coding to avoid misidentification)
      if (isCodeableConcept(value)) {
        return createSmartCodeableConcept(value);
      }

      // Wrap Coding objects
      if (isCoding(value)) {
        return createSmartCoding(value);
      }

      // Handle arrays - wrap each element if needed
      if (Array.isArray(value)) {
        return value.map(item => {
          if (item === null || item === undefined) {
            return item;
          }
          // Check CodeableConcept before Coding
          if (isCodeableConcept(item)) {
            return createSmartCodeableConcept(item);
          }
          if (isCoding(item)) {
            return createSmartCoding(item);
          }
          // Recursively wrap plain objects, not built-in types
          if (typeof item === "object" && !Array.isArray(item) && item.constructor === Object) {
            return createTransparentProxy(item);
          }
          return item;
        });
      }

      // Recursively wrap plain objects (but not primitives, dates, etc.)
      // Only wrap plain objects, not built-in types like Date, RegExp, etc.
      if (typeof value === "object" && !Array.isArray(value) && value.constructor === Object) {
        return createTransparentProxy(value);
      }

      // Return primitives, dates, and other built-in types as-is
      return value;
    },

    // Handle Symbol.toStringTag for better console display
    ownKeys: target => {
      return Reflect.ownKeys(target);
    },

    getOwnPropertyDescriptor: (target, prop) => {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as T;

  // Cache the proxy
  transparentProxyCache.set(obj, proxy);

  return proxy;
}
