// Helper to strip undefined/null when recursing
type NonNull<T> = NonNullable<T>;

// Depth limiter to prevent infinite recursion in path types
type Prev = [never, 0, 1, 2, 3, 4];

type PathFor<T, V, D extends number = 4> = [D] extends [never]
  ? never
  : {
      [K in keyof T & string]: T[K] extends V
        ? K
        : NonNull<T[K]> extends object
        ? `${K}.${PathFor<NonNull<T[K]>, V, Prev[D]>}`
        : never;
    }[keyof T & string];

/** All valid dot-notation paths in T (any value type), limited to 4 levels deep */
export type AnyPath<T, D extends number = 4> = [D] extends [never]
  ? never
  : {
      [K in keyof T & string]: NonNull<T[K]> extends object
        ? K | `${K}.${AnyPath<NonNull<T[K]>, Prev[D]>}`
        : K;
    }[keyof T & string];

/** Top-level keys of T that are objects */
export type ObjectKey<T> = {
  [K in keyof T & string]: NonNull<T[K]> extends object ? K : never;
}[keyof T & string];

/** Extracts the type at a given dot-notation path in T */
export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<NonNull<T[K]>, Rest>
    : never
  : P extends keyof T
  ? T[P]
  : never;

/**
 * DynamoDB Update Builder for deeply nested objects.
 *
 * @template T - The type of the object to build the update for.
 * @example
 * const builder = new DynamoDbUpdateBuilder<PatientState>();
 * builder.addIncrement("dq.gatewaySuccess", 1);
 * builder.setValue("dq.status", "completed");
 * builder.setObject("pd", { requestId: "123", ... });
 * ddbClient.update({
 *   ...
 *   UpdateExpression: `SET ${builder.setExpressions.join(", ")}`,
 *   ExpressionAttributeNames: builder.names,
 *   ExpressionAttributeValues: builder.values,
 *   ...
 * })
 */
export class DynamoDbUpdateBuilder<T> {
  public setExpressions: string[] = [];
  public names: Record<string, string> = {};
  public values: Record<string, unknown> = {};
  private counter = 0;

  // Helper to generate unique variables (:val1, :val2) to avoid collisions
  private getUniqueValueKey(prefix: string) {
    return `:${prefix}${this.counter++}`;
  }

  /**
   * Helper to process "dq.gatewaySuccess" into "#dq.#gatewaySuccess"
   * and update ExpressionAttributeNames automatically
   */
  private processPath(path: string): string {
    const segments = path.split(".");
    const expressionParts = segments.map(segment => {
      const safeName = `#${segment}`;
      this.names[safeName] = segment;
      return safeName;
    });
    return expressionParts.join(".");
  }

  /**
   * Adds an atomic increment operation.
   * STRICTLY TYPED: The 'path' must point to a number property in T.
   * @example builder.addIncrement("dq.gatewaySuccess", 1);
   */
  public addIncrement(path: PathFor<T, number>, value: number) {
    if (value === 0) return;

    const dbPath = this.processPath(path);
    const valKey = this.getUniqueValueKey("inc");
    const zeroKey = ":zero";

    // e.g. #dq.#success = if_not_exists(#dq.#success, :zero) + :inc0
    this.setExpressions.push(`${dbPath} = if_not_exists(${dbPath}, ${zeroKey}) + ${valKey}`);

    this.values[valKey] = value;
    this.values[zeroKey] = 0;
  }

  /**
   * Sets a value at a nested path.
   * STRICTLY TYPED: Both 'path' and 'value' are type-checked against T.
   * Skips if value is undefined.
   * @example builder.setValue("dq.status", "completed")
   */
  public setValue<P extends AnyPath<T>>(path: P, value: PathValue<T, P> | undefined) {
    if (value === undefined) return;

    const dbPath = this.processPath(path);
    const valKey = this.getUniqueValueKey("val");

    this.setExpressions.push(`${dbPath} = ${valKey}`);
    this.values[valKey] = value;
  }

  /**
   * Sets an entire object at a top-level key.
   * STRICTLY TYPED: The 'key' must be a top-level object key in T.
   * @example builder.setObject("pd", { requestId: "123", status: "processing", ... })
   */
  public setObject(key: ObjectKey<T>, value: NonNullable<T[ObjectKey<T>]>) {
    const safeName = `#${key}`;
    this.names[safeName] = key;

    const valKey = this.getUniqueValueKey("obj");
    this.setExpressions.push(`${safeName} = ${valKey}`);
    this.values[valKey] = value;
  }
}
