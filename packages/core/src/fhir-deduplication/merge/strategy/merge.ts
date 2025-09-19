/**
 * Merges arrays of strings into a single array of strings, and removes duplicate strings.
 *
 * @param masterStringArray - the string array on the master resource
 * @param stringArrays - additional string arrays on other equal resources
 * @returns the merged string array
 */
export function mergeStringArrays(
  masterStringArray: string[] | undefined,
  stringArrays: string[][]
): string[] | undefined {
  const mergedStringSet = new Set(masterStringArray ?? []);
  for (const stringArray of stringArrays) {
    for (const string of stringArray) {
      mergedStringSet.add(string);
    }
  }
  return Array.from(mergedStringSet);
}
