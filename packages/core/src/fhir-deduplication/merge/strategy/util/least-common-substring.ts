/**
 * Merges two strings by the least common substrings of words between them. This is a merge strategy
 * that will avoid duplicating strings if they are
 * @param a
 * @param b
 * @returns
 */
export function mergeWithLeastCommonSubstring(a: string, b: string): string {
  const wordsA = tokenizeString(a);
  const wordsB = tokenizeString(b);

  const n = wordsA.length;
  const m = wordsB.length;

  // DP table for LCS lengths
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  // Fill LCS dp table
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const dpi = dp[i] as number[];
      const dp_i_minus_1 = dp[i - 1] as number[];
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dpi[j] = (dp_i_minus_1[j - 1] ?? 0) + 1;
      } else {
        dpi[j] = Math.max(dp_i_minus_1[j] ?? 0, dpi[j - 1] ?? 0);
      }
    }
  }

  // Backtrack to build merged sequence (SCS)
  let i = n,
    j = m;
  const merged: string[] = [];

  while (i > 0 && j > 0) {
    const wordA = wordsA[i - 1] as string;
    const wordB = wordsB[j - 1] as string;
    const dpi = dp[i] as number[];
    const dp_i_minus_1 = dp[i - 1] as number[];
    if (equalStrings(wordA, wordB)) {
      merged.push(wordA);
      i--;
      j--;
    } else if ((dp_i_minus_1[j] ?? 0) >= (dpi[j - 1] ?? 0)) {
      merged.push(wordA);
      i--;
    } else {
      merged.push(wordB);
      j--;
    }
  }

  // Add leftovers
  while (i > 0) {
    merged.push(wordsA[i - 1] as string);
    i--;
  }
  while (j > 0) {
    merged.push(wordsB[j - 1] as string);
    j--;
  }

  return merged.reverse().join("");
}

function tokenizeString(str: string): string[] {
  return str
    .trim()
    .split(/(\s+|\s*,\s*|\s*\.\s*)/)
    .filter(str => str.length > 0);
}

function equalStrings(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
