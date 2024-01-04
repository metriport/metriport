import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { formatNumber } from "./numbers";

dayjs.extend(duration);

export async function logDuration<T>(
  fn: () => Promise<T>,
  options?: { log?: typeof console.log; withMinutes?: boolean }
): Promise<T> {
  const { log = console.log, withMinutes = true } = options ?? {};
  const startedAt = Date.now();

  let success = false;
  try {
    const res = await fn();
    success = true;
    return res;
  } finally {
    const duration = Date.now() - startedAt;
    const durationMin = withMinutes
      ? ` / ${formatNumber(dayjs.duration(duration).asMinutes())} min`
      : "";
    const successMsg = success ? "" : " (with errors)";
    log(`It took ${duration} ms${durationMin} to execute${successMsg}`);
  }
}
