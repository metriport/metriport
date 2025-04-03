import * as crypto from "crypto";
import { BASE64_CHARS, isValidBase64 } from "./base64";

/**
 * A utility for scrambling base64 strings while maintaining exact length
 */
export class Base64Scrambler {
  private mappingForward: Map<string, string>;
  private mappingReverse: Map<string, string>;

  /**
   * Initialize the scrambler with a secret string
   * @param secret - A string to use as the scrambling key
   */
  constructor(secret: string) {
    // Create a consistent character mapping based on the secret
    [this.mappingForward, this.mappingReverse] = this.generateMappings(secret);
  }

  /**
   * Generate consistent character mappings based on the secret
   * @param secret - The secret key
   * @returns Two maps: forward (original→scrambled) and reverse (scrambled→original)
   */
  private generateMappings(secret: string): [Map<string, string>, Map<string, string>] {
    const buffer = crypto.createHash("sha256").update(secret).digest();
    const chars = BASE64_CHARS.split("");

    for (let i = chars.length - 1; i > 0; i--) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const j = buffer[i % buffer.length]! % (i + 1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      [chars[i], chars[j]] = [chars[j]!, chars[i]!];
    }

    const forwardMap = new Map<string, string>();
    const reverseMap = new Map<string, string>();

    for (let i = 0; i < BASE64_CHARS.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const originalChar = BASE64_CHARS[i]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const scrambledChar = chars[i]!;

      forwardMap.set(originalChar, scrambledChar);
      reverseMap.set(scrambledChar, originalChar);
    }

    // Skip scrambling the b64 padding character
    forwardMap.set("=", "=");
    reverseMap.set("=", "=");

    return [forwardMap, reverseMap];
  }

  /**
   * Scramble a base64 string
   * @param base64String - The base64 string to scramble
   * @returns The scrambled string of the same length
   * @throws Error if the string contains non-base64 characters
   */
  scramble(base64String: string): string {
    if (!isValidBase64(base64String)) {
      throw new Error("Input is not a valid base64 string");
    }

    return base64String
      .split("")
      .map(char => this.mappingForward.get(char) || char)
      .join("");
  }

  /**
   * Unscramble a previously scrambled base64 string
   * @param scrambledString - The scrambled string to unscramble
   * @returns The original base64 string
   */
  unscramble(scrambledString: string): string {
    if (!isValidBase64(scrambledString)) {
      throw new Error("Input is not a valid base64 string");
    }

    return scrambledString
      .split("")
      .map(char => this.mappingReverse.get(char) || char)
      .join("");
  }
}
