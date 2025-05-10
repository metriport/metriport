const validDayStrings = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const validMonthStrings = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Validates an AWS EventBridge cron expression.
 * AWS EventBridge cron expressions have the following format:
 * cron(Minutes Hours Day-of-month Month Day-of-week Year)
 *
 * @param cronExpression - The cron expression to validate
 * @throws Error if the cron expression is invalid
 */
export function validateCronExpression(cronExpression: string): void {
  // Remove 'cron(' and ')' if present
  const cleanExpression = cronExpression.replace(/^cron\(|\)$/g, "").trim();

  // Split the expression into its components
  const parts = cleanExpression.split(/\s+/);

  if (parts.length !== 6) {
    throw new Error(
      `Invalid cron expression: "${cronExpression}". Expected 6 fields (Minutes Hours Day-of-month Month Day-of-week Year)`
    );
  }

  // We know these are strings because we checked parts.length === 6
  const [minutes, hours, dayOfMonth, month, dayOfWeek, year] = parts as [
    string,
    string,
    string,
    string,
    string,
    string
  ];

  validateField(minutes, "minutes", 0, 59);
  validateField(hours, "hours", 0, 23);
  validateField(dayOfMonth, "day of month", 1, 31, true);
  validateMonth(month);
  validateDayOfWeek(dayOfWeek);
  validateYear(year);
}

function validateField(
  value: string,
  fieldName: string,
  min: number,
  max: number,
  allowQuestionMark = false
): void {
  if (value === "*") return;
  if (allowQuestionMark && value === "?") return;

  const parts = value.split(/[,-/]/);
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < min || num > max) {
      throw new Error(
        `Invalid ${fieldName} in cron expression: "${value}". Must be ${min}-${max}${
          allowQuestionMark ? " or ?" : ""
        }`
      );
    }
  }
}

function validateMonth(value: string): void {
  if (value === "*" || value === "?") return;

  const parts = value.split(/[,-/]/);

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num)) {
      if (!validMonthStrings.includes(part)) {
        throw new Error(`Invalid month in cron expression: "${value}". Must be 1-12 or JAN-DEC`);
      }
    } else if (num < 1 || num > 12) {
      throw new Error(`Invalid month in cron expression: "${value}". Must be 1-12 or JAN-DEC`);
    }
  }
}

function validateDayOfWeek(value: string): void {
  if (value === "*" || value === "?") return;

  const parts = value.split(/[,-/]/);

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num)) {
      if (!validDayStrings.includes(part)) {
        throw new Error(
          `Invalid day of week in cron expression: "${value}". Must be 1-7 or SUN-SAT`
        );
      }
    } else if (num < 1 || num > 7) {
      throw new Error(`Invalid day of week in cron expression: "${value}". Must be 1-7 or SUN-SAT`);
    }
  }
}

function validateYear(value: string): void {
  if (value === "*") return;

  const year = parseInt(value, 10);
  if (isNaN(year) || year < 1970 || year > 2199) {
    throw new Error(`Invalid year in cron expression: "${value}". Must be 1970-2199 or *`);
  }
}
