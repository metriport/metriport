import { CodeableConcept, Specimen } from "@medplum/fhirtypes";
import { SNOMED_URL } from "@metriport/shared/medical";

export const SPECIMEN_STATUS_CODES = [
  "entered-in-error",
  "unavailable",
  "unsatisfactory",
  "available",
] as const;

export type SpecimenStatusCode = (typeof SPECIMEN_STATUS_CODES)[number];

export function compareSpecimensByStatus(a: Specimen, b: Specimen): number {
  const aStatus = a.status ?? SPECIMEN_STATUS_CODES[0];
  const bStatus = b.status ?? SPECIMEN_STATUS_CODES[0];
  return SPECIMEN_STATUS_CODES.indexOf(aStatus) - SPECIMEN_STATUS_CODES.indexOf(bStatus);
}

export const SPECIMEN_COLLECTION_METHODS: [string, string, { keywords: string[] }][] = [
  ["129316008", "Aspiration - action", { keywords: ["aspiration"] }],
  ["129314006", "Biopsy - action", { keywords: ["biopsy"] }],
  ["129300006", "Puncture - action", { keywords: ["puncture"] }],
  ["129304002", "Excision - action", { keywords: ["excision"] }],
  ["129323009", "Scraping - action", { keywords: ["scraping"] }],
  ["73416001", "Urine specimen collection, clean catch", { keywords: ["urine", "clean catch"] }],
  ["225113003", "Timed urine collection", { keywords: ["urine", "timed"] }],
  ["70777001", "Urine specimen collection, catheterized", { keywords: ["urine", "catheterized"] }],
  ["386089008", "Collection of coughed sputum", { keywords: ["sputum", "cough"] }],
  [
    "278450005",
    "Finger-prick sampling",
    { keywords: ["finger", "prick", "fingerprick", "finger-prick"] },
  ],
];

export function getSpecimenCollectionKeywords(inputText: string): CodeableConcept | undefined {
  const words = inputText.toLowerCase().split(" ");
  for (const method of SPECIMEN_COLLECTION_METHODS) {
    const [code, display, { keywords }] = method;
    if (keywords.every(keyword => words.includes(keyword))) {
      return {
        coding: [
          {
            system: SNOMED_URL,
            code,
            display,
          },
        ],
      };
    }
  }
  return undefined;
}
