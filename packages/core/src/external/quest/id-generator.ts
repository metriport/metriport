import crypto from "crypto";
const MAX_EXTERNAL_ID_LENGTH = 15;
const LEXICON = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a random 15 character string in the allowed character range. If we generate
 * a unique ID for every person on Earth, the birthday collision probability is around 1 in 200k.
 * If there is a unique ID for every American, the probability is closer to 1 in 2 million.
 * This means that it is *within the realm of statistical possibility to generate a duplicate ID*,
 * especially over many iterations. Therefore, a uniqueness constraint on this ID should be enforced.
 */
export function buildQuestExternalId(): string {
  const idCharacter = new Array(15);
  for (let i = 0; i < MAX_EXTERNAL_ID_LENGTH; i++) {
    const randomIndex = crypto.randomInt(LEXICON.length);
    idCharacter[i] = LEXICON[randomIndex];
  }
  return idCharacter.join("");
}
