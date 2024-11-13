export function toTitleCase(str: string): string {
  const trimmedStr = str.trim();
  const words = trimmedStr.toLowerCase().split(/(?=[A-Z])|[\s]+/);
  return words
    .map(word => {
      if (!word) return "";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}
