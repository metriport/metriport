export function toTitleCase(str: string): string {
  const trimmedStr = str.trim();
  const words = trimmedStr.toLowerCase().split(/(?=[A-Z])|[\s]+/);
  return words
    .map(word => {
      if (!word) return "";
      return word
        .split("'") // supports names with apostrophes, like D'Angelo
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join("'");
    })
    .join(" ");
}
