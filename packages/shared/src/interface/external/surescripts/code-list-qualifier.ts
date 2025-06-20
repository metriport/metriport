export const CodeListQualifiers = ["38", "40", "87", "QS"] as const;
export const CodeListQualifierNames = [
  "Original Quantity",
  "Remaining Quantity",
  "Quantity Received",
  "Quantity Sufficient",
] as const;
export type CodeListQualifier = (typeof CodeListQualifiers)[number];
export type CodeListQualifierName = (typeof CodeListQualifierNames)[number];

export const CodeListQualifierName: Record<CodeListQualifier, CodeListQualifierName> = {
  "38": "Original Quantity",
  "40": "Remaining Quantity",
  "87": "Quantity Received",
  QS: "Quantity Sufficient",
};
