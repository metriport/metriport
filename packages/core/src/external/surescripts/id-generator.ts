export type IdGenerator = (time?: number, entropy?: 0 | 1) => Buffer;
const LEXICON = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
const LEXICON_START = LEXICON.charCodeAt(0);
const LEXICON_END = LEXICON.charCodeAt(LEXICON.length - 1);

export function createIdGenerator(
  totalLength: number,
  initialState: {
    // for testing purposes
    lastGenerationTime?: number;
    entropyOfLastGeneratedId?: Buffer;
  } = {}
): IdGenerator {
  if (totalLength < 8) throw new Error("Total length must be at least 8");
  const entropyLength = totalLength - 8;

  // Within an ID generator context, these shared vars enforce an invariant that
  // two sequentially generated IDs will *always* be lexicographically ordered correctly.
  let lastTime: number | null = initialState.lastGenerationTime ?? null;
  const lastEntropy: Buffer = initialState.entropyOfLastGeneratedId ?? Buffer.alloc(entropyLength);

  return function (time?: number, entropy?: 0 | 1): Buffer {
    const id: Buffer = Buffer.alloc(totalLength);
    let sameMillisecondAsLastId = false;

    let now: number = time ?? Date.now();
    sameMillisecondAsLastId = now === lastTime;
    if (time == null) {
      lastTime = now;
    }

    for (let i = 7; i >= 0; i--) {
      id.writeUint8(LEXICON.charCodeAt(now % 64), i);
      now = Math.floor(now / 64);
    }

    // Do not generate random entropy if there is an explicit entropy value, usually for range queries
    if (entropy != null) {
      for (let i = 0; i < entropyLength; i++) {
        id.writeUint8((entropy === 1 ? "z" : "-").charCodeAt(0), i + 8);
      }
    }
    // If this is a duplicate timestamp
    else if (sameMillisecondAsLastId) {
      // Apply a carry to every right-bit that is a "z"
      let i = entropyLength - 1;
      for (; i >= 0 && lastEntropy.readUInt8(i) === LEXICON_END; i--) {
        lastEntropy.writeUInt8(LEXICON_START, i);
      }
      // Increment the left-most bit if there is one, otherwise allow the entropy to simply overflow
      if (i >= 0) {
        lastEntropy.writeUInt8(lastEntropy.readUInt8(i) + 1, i);
      }
    }
    // Generate random entropy
    else {
      for (let i = 0; i < entropyLength; i++) {
        lastEntropy.writeUInt8(LEXICON.charCodeAt(Math.floor(Math.random() * 64)), i);
      }
    }

    // Insert the entropy characters
    for (let i = 0; i < entropyLength; i++) {
      id.writeUint8(lastEntropy.readUInt8(i), i + 8);
    }
    return id;
  };
}
