/**
 * Generates a valid NPI number that passes the validateNPI() function.
 *
 * Generated with by Anthropic's Claude 3.5.
 * Slightly updated by human.
 *
 * @returns A valid 10-digit NPI number as a string.
 */
export function makeNPI(): string {
  const digits: number[] = [];

  // Generate the first 9 digits
  digits.push(Math.random() < 0.5 ? 1 : 2); // First digit is either 1 or 2
  for (let i = 1; i < 9; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }

  let sum = 24; // Account for NPI prefix (80840)
  let shouldDouble = true;

  digits.forEach(digit => {
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  });

  const checkDigit = (10 - (sum % 10)) % 10;
  digits.push(checkDigit);

  return digits.join("");
}
