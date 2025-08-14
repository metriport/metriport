const MAX_EXTERNAL_ID_LENGTH = 15;
const LEXICON = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a random 15 character string in the allowed character range. If we generate
 * an ID for each person on Earth, there is a 1 in 361 trillion chance of a collision.
 */
export function buildQuestExternalId(): string {
  return Array.from(
    { length: MAX_EXTERNAL_ID_LENGTH },
    () => LEXICON[Math.floor(Math.random() * LEXICON.length)]
  ).join("");
}
