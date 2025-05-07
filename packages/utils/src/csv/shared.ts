export function mapHeadersForCsvParser({ header }: { header: string }): string {
  const parsedHeader = header.replace(/[!@#$%^&*()+=\-[\]\\';,./{}|":<>?~_\s]/gi, "").toLowerCase();
  return parsedHeader;
}
