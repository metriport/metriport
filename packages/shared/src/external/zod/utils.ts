import { ZodIssue } from "zod";

export function zodIssueToObject(issue: ZodIssue): {
  field: string;
  expected: string;
  code: string;
} {
  return {
    field: issue.path.join("."),
    expected: issue.message,
    code: issue.code,
  };
}

export function zodIssueToString(issue: ZodIssue): string {
  return `${issue.path.join(".")}, ${issue.message}, ${issue.code}`;
}
