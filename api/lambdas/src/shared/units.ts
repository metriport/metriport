export function kbToMbString(value: number) {
  return Number(kbToMb(value)).toFixed(2) + "MB";
}

export function kbToMb(value: number) {
  return value / 1048576;
}
