const OID_REGEX = /(?:[^.\d]*)((([0-9]*)(?:\.*))*)*(?:[^.\d]*)/;

export function normalizeOid(input: string): string {
  const match = input.match(OID_REGEX);
  // The OID should not contain "..". If it does, it is not a valid OID.
  // The root of OID must be 0, 1 or 2. If it is not, it is not a valid OID. (i.e. '1000' is not a valid OID)
  if (match && match[1]) {
    const oidCandidate = match[1];
    if (!oidCandidate.includes("..") && startsWithRootCode(oidCandidate)) {
      return oidCandidate;
    }
  }

  throw new Error("OID is not valid");
}

/**
 * Parses an OID from a string, handling various formats and extracting the valid OID portion
 * @param input - String that may contain an OID
 * @returns The parsed and normalized OID string
 * @throws Error if no valid OID can be found in the input
 */
export function parseOid(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Input must be a non-empty string");
  }

  // Enhanced regex to find OID patterns in various contexts
  // Matches: 1.2.3.4, urn:oid:1.2.3.4, /path/1.2.3.4, ?oid=1.2.3.4, etc.
  const oidPatterns = [
    /urn:oid:([0-9]+(?:\.[0-9]+)*)/i,
    /[?&]oid=([0-9]+(?:\.[0-9]+)*)/i,
    /[?&]id=([0-9]+(?:\.[0-9]+)*)/i,
    /[\s]([0-9]+(?:\.[0-9]+)*)[\s]/,
    /^([0-9]+(?:\.[0-9]+)*)$/,
    /([0-9]+(?:\.[0-9]+)*)/g,
  ];

  // Try each pattern to find a valid OID
  for (const pattern of oidPatterns) {
    const matches = input.match(pattern);
    if (matches) {
      // For patterns with capture groups, use the first capture group
      const oidCandidate = matches[1] || matches[0];

      if (isValidOid(oidCandidate)) {
        return oidCandidate;
      }
    }
  }

  // If no pattern matched, try to extract any sequence of numbers and dots
  const allMatches = input.match(/([0-9]+(?:\.[0-9]+)*)/g);
  if (allMatches) {
    for (const match of allMatches) {
      if (isValidOid(match)) {
        return match;
      }
    }
  }

  throw new Error("No valid OID found in input string");
}

/**
 * Validates if a string is a valid OID
 * @param oid - The OID string to validate
 * @returns True if the OID is valid, false otherwise
 */
function isValidOid(oid: string): boolean {
  if (!oid || typeof oid !== "string") {
    return false;
  }

  // Check for consecutive dots
  if (oid.includes("..")) {
    return false;
  }

  // Check if it starts with valid root code (0, 1, or 2)
  return startsWithRootCode(oid);
}

function startsWithRootCode(oid: string): boolean {
  if (oid.includes(".")) {
    const root = oid.split(".")[0];
    if (root) {
      const rootInt = parseInt(root);
      return isWithinRootBounds(rootInt) ?? false;
    }
  } else {
    return isWithinRootBounds(parseInt(oid));
  }
  return false;
}

function isWithinRootBounds(root: number): boolean {
  return root >= 0 && root <= 2;
}
