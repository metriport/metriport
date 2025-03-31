export const unknownCoding = {
  system: "http://terminology.hl7.org/ValueSet/v3-Unknown",
  code: "UNK",
  display: "unknown",
};

export function buildUnknownCoding(display?: string | undefined) {
  return {
    ...unknownCoding,
    ...(display ? { display } : { display: unknownCoding.display }),
  };
}
