/**
 * Check if two strings are fuzzy matches based on similarity threshold
 */
export function isFuzzyMatch(str1: string, str2: string, threshold = 0.8): boolean {
  const similarity = calculateSimilarityRatio(str1, str2);
  return similarity >= threshold;
}

/**
 * Calculate similarity ratio between two strings (0-1, where 1 is identical)
 */
function calculateSimilarityRatio(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 * This measures how many single-character edits are needed to transform one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  // Simple implementation using a single array to avoid TypeScript issues
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;

  const prev = new Array(str2.length + 1);
  const curr = new Array(str2.length + 1);

  // Initialize previous row
  for (let j = 0; j <= str2.length; j++) {
    prev[j] = j;
  }

  // Fill current row
  for (let i = 1; i <= str1.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // deletion
        prev[j] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }

    // Copy current row to previous row for next iteration
    for (let j = 0; j <= str2.length; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[str2.length];
}
