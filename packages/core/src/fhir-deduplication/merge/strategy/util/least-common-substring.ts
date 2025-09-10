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

  return joinTokens(merged.reverse());
}

function tokenizeString(str: string): string[] {
  if (!str) return [];

  // Regex explanation:
  // - \p{L}+ → sequence of letters (Unicode)
  // - \p{N}+ → sequence of digits (Unicode numbers)
  // - \p{S}+ → symbols (e.g. ≈, $, %, +)
  // - \p{P}+ → punctuation (e.g. .,!?-)
  // - \p{M}+ → diacritics/marks
  // - Any single non-space character
  //
  // The "u" flag enables Unicode mode.
  const tokenPattern = /[\p{L}\p{M}]+|\p{N}+|\p{S}|\p{P}/gu;

  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(str)) !== null) {
    tokens.push(match[0]);
  }

  return tokens;
}

/**
 * Joins tokens back into a readable string. It adds spaces between words/numbers, avoids spaces before
 * punctuation/symbols, and preserves decimals like "3.14".
 */
export function joinTokens(tokens: string[]): string {
  if (!tokens || tokens.length === 0) return "";

  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const prev = tokens[i - 1];

    // Decide if we need a space
    if (i > 0) {
      const previousIsNumber = prev && isWordOrNumber(prev);
      const currentIsNumber = isWordOrNumber(tok);
      const currentIsSymbol = isPunctuationOrSymbol(tok);
      const previousIsSymbol = prev && isPunctuationOrSymbol(prev);

      let addSpace = false;
      if (previousIsNumber && currentIsNumber) {
        addSpace = true; // word → word
      } else if (previousIsNumber && currentIsSymbol) {
        addSpace = false; // word → punctuation
      } else if (previousIsSymbol && currentIsNumber) {
        addSpace = true; // punctuation → word
      } else if (previousIsSymbol && currentIsSymbol) {
        addSpace = false; // punctuation → punctuation
      }

      if (addSpace) result.push(" ");
    }

    if (tok) {
      result.push(tok);
    }
  }

  return result.join("");
}

function isWordOrNumber(token: string | undefined): boolean {
  if (!token) return false;
  return /^[\p{L}\p{M}\p{N}]+$/u.test(token);
}

function isPunctuationOrSymbol(token: string | undefined): boolean {
  if (!token) return false;
  return /^[\p{P}\p{S}]$/u.test(token);
}

function equalStrings(a: string | undefined, b: string | undefined): boolean {
  if (a == null || b == null) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
