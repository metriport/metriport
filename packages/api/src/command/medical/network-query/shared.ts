import _ from "lodash";

export async function getAllDefinedPromiseResults<T>(
  promises: Promise<T | undefined>[]
): Promise<NonNullable<T>[]> {
  const results = await Promise.allSettled(promises);
  const values = _.flatten(
    results.map(result =>
      result.status === "fulfilled" && result.value != null ? result.value : []
    )
  );
  return values as NonNullable<T>[];
}
