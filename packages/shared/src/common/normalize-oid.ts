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
