export function commonReplacementsForAddressLine(addressLine: string): string {
  return addressLine
    .replace(/street/g, "st")
    .replace(/drive/g, "dr")
    .replace(/road/g, "rd")
    .replace(/avenue/g, "ave");
}
