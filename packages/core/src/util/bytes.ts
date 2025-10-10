export function formatBytes(bytes: number, useBinaryUnits = false, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = useBinaryUnits ? 1024 : 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const units = useBinaryUnits
    ? ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    : ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + units[i];
}
