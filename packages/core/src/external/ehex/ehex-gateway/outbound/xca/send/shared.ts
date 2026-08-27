const errorContentToSkip = [
  "ECONNRESET",
  "Request failed with status code 500",
  "Request failed with status code 502",
  "Bad Gateway",
  "AxiosError: timeout of",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function shouldReportOutboundError(error: any): boolean {
  return !errorContentToSkip.some(
    content => error.message?.includes(content) || error.toString()?.includes(content)
  );
}
