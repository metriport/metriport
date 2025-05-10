import { validateCronExpression } from "../../lib/shared/cron-validator";

describe("validateCronExpression", () => {
  it("should accept valid cron expressions", () => {
    const validExpressions = [
      "cron(0 12 * * ? *)", // Every day at 12:00 PM UTC
      "cron(0/15 * * * ? *)", // Every 15 minutes
      "cron(0 10 ? * MON-FRI *)", // Every Monday-Friday at 10:00 AM UTC
      "cron(0 8 1 * ? *)", // At 8:00 AM UTC on day 1 of every month
      "cron(0 9 ? * 2-6 *)", // Every Monday-Friday at 9:00 AM UTC
      "cron(0 12 * * ? 2023)", // Every day at 12:00 PM UTC in 2023
      "cron(0 12 * * ? *)", // Every day at 12:00 PM UTC
      "cron(0 12 ? * MON *)", // Every Monday at 12:00 PM UTC
      "cron(0 12 ? * 1 *)", // Every Monday at 12:00 PM UTC (using 1 instead of MON)
      "cron(0 12 ? JAN-MAR * *)", // Every day at 12:00 PM UTC in January through March
      "cron(0 12 ? * 1-5 *)", // Every Monday through Friday at 12:00 PM UTC
      "cron(0 12 ? * 1,3,5 *)", // Every Monday, Wednesday, and Friday at 12:00 PM UTC
      "cron(0 12 ? * MON,WED,FRI *)", // Every Monday, Wednesday, and Friday at 12:00 PM UTC
      "cron(0 12 ? * 1/2 *)", // Every other day of the week starting on Monday at 12:00 PM UTC
      "cron(0 12 ? * MON/2 *)", // Every other day of the week starting on Monday at 12:00 PM UTC
    ];

    validExpressions.forEach(expression => {
      expect(() => validateCronExpression(expression)).not.toThrow();
    });
  });

  it("should reject invalid cron expressions", () => {
    const invalidExpressions = [
      { expr: "cron(60 * * * ? *)", error: "Invalid minutes" },
      { expr: "cron(* 24 * * ? *)", error: "Invalid hours" },
      { expr: "cron(* * 32 * ? *)", error: "Invalid day of month" },
      { expr: "cron(* * * 13 ? *)", error: "Invalid month" },
      { expr: "cron(* * * * 8 *)", error: "Invalid day of week" },
      { expr: "cron(* * * * * 1969)", error: "Invalid year" },
      { expr: "cron(* * * * * 2200)", error: "Invalid year" },
      { expr: "cron(* * * * INVALID *)", error: "Invalid day of week" },
      { expr: "cron(* * * INVALID ? *)", error: "Invalid month" },
      { expr: "cron(* * * * ?)", error: "Expected 6 fields" },
      { expr: "cron(* * * * ? * *)", error: "Expected 6 fields" },
      { expr: "invalid", error: "Expected 6 fields" },
    ];

    invalidExpressions.forEach(({ expr, error }) => {
      expect(() => validateCronExpression(expr)).toThrow(error);
    });
  });

  it("should handle special characters correctly", () => {
    const validSpecialChars = [
      "cron(* * * * ? *)", // Wildcard
      "cron(* * ? * * *)", // Question mark
      "cron(0-59 * * * ? *)", // Range
      "cron(0,15,30,45 * * * ? *)", // List
      "cron(0/15 * * * ? *)", // Step
      "cron(*/5 * * * ? *)", // Wildcard Step
    ];

    validSpecialChars.forEach(expression => {
      expect(() => validateCronExpression(expression)).not.toThrow();
    });
  });
});
