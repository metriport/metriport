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
