import { CodeSystem, ConceptMap, Parameters } from "@medplum/fhirtypes";
import { createReadStream } from "node:fs";
import { argv } from "node:process";
import { createInterface } from "node:readline";
import { Readable, Transform, TransformCallback } from "node:stream";
import * as unzip from "unzip-stream";
import { ndcCodeSystem } from "../operations/definitions/codeSystem";
import { TerminologyClient } from "../client";
import { UmlsAttribute, UmlsConcept } from "./classes";
import { sendParameters } from "./shared";

/**
 * Script to process UMLS NDC data through the RxNorm mapping, and create crosswalks between RxNorm and NDC codes.
 *
 * This script:
 * 1. Processes a UMLS release archive containing RxNorm and NDC data
 * 2. Extracts and processes concepts from RXNCONSO.RRF and properties from RXNSAT.RRF
 * 3. Creates mappings between RxNorm codes and their corresponding NDC codes
 * 4. Uploads the mappings to a terminology service
 * 5. Creates bidirectional crosswalks between RxNorm and NDC codes
 *
 * @usage npm run seed-ndc-lookup <rxnorm-archive-path>
 */

type UmlsSource = { name: "NDC"; system: string; tty: string[]; resource: CodeSystem };

export const ndcSource: UmlsSource = {
  name: "NDC",
  system: "http://hl7.org/fhir/sid/ndc",
  tty: ["SCD", "SBD", "GPCK", "BPCK"],
  resource: ndcCodeSystem,
};

class EOF extends Error {
  message = "<EOF>";
}

type RxNormToNdcAttributes = {
  description: string;
  rxNormCode: string;
  ndcCodes: string[];
  tty: string;
};

async function sendRxNormToNdcMappings(
  mappings: Record<string, RxNormToNdcAttributes>,
  client: TerminologyClient
): Promise<void> {
  const batchSize = 500;
  const entries = Object.entries(mappings);
  const batches = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }

  console.log(`Sending ${batches.length} batches of RxNorm to NDC mappings...`);

  for (const [index, batch] of batches.entries()) {
    const parameters = {
      resourceType: "Parameters",
      parameter: [
        { name: "system", valueUri: "http://hl7.org/fhir/sid/ndc" },
        ...batch.flatMap(([, attributes]) => {
          if (!attributes.ndcCodes.length) {
            return [];
          }

          return attributes.ndcCodes.map(ndcCode => ({
            name: "concept",
            valueCoding: {
              code: ndcCode,
              display: attributes.description,
            },
          }));
        }),
      ],
    } as Parameters;

    await sendParameters(parameters, client);
    console.log(`Processed batch ${index + 1}/${batches.length}`);
  }
}

const ndcToRxNormTemplateMap: ConceptMap = {
  resourceType: "ConceptMap",
  status: "active",
  group: [
    {
      source: "http://hl7.org/fhir/sid/ndc",
      target: "http://www.nlm.nih.gov/research/umls/rxnorm",
      element: [],
    },
  ],
};

async function createRxNormNdcCrosswalks(
  mappings: Record<string, RxNormToNdcAttributes>,
  client: TerminologyClient
): Promise<void> {
  const entries = Object.entries(mappings);
  const totalMappings = entries.reduce((acc, [, mapping]) => acc + mapping.ndcCodes.length, 0);
  let processedMappings = 0;

  for (const [key, mapping] of entries) {
    if (!mapping.ndcCodes.length) {
      continue;
    }

    for (const ndcCode of mapping.ndcCodes) {
      const ndcToRxNormMap = {
        ...ndcToRxNormTemplateMap,
        ...(ndcToRxNormTemplateMap.group?.[0]
          ? {
              group: [
                {
                  ...ndcToRxNormTemplateMap.group[0],
                  element: [
                    {
                      code: ndcCode,
                      target: [
                        {
                          code: mapping.rxNormCode,
                          equivalence: "equivalent" as const,
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : {}),
      };
      try {
        await client.importConceptMap(ndcToRxNormMap, false);
        processedMappings++;

        // Update progress every 100 mappings
        if (processedMappings % 100 === 0 || processedMappings === totalMappings) {
          const percent = Math.round((processedMappings / totalMappings) * 100);
          const progressBar = "=".repeat(percent / 2) + "-".repeat(50 - percent / 2);
          process.stdout.write(
            `\rProgress: [${progressBar}] ${percent}% (${processedMappings}/${totalMappings})`
          );
        }
      } catch (error) {
        console.error(`Error importing concept map for ${key}: ${error}`);
      }
    }
  }

  console.log("");
}

async function main(): Promise<void> {
  const [archivePath] = argv.slice(2);
  if (!archivePath) {
    return Promise.reject(
      new Error(
        "Missing argument: specify path to UMLS release archive (e.g. umls-2023AB-full.zip)\nUsage: npm run umls <archivePath> <clientID> <clientSecret> [baseUrl]"
      )
    );
  }
  let resolve: () => void, reject: (e: Error) => void;
  const result = new Promise<void>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });

  const client = new TerminologyClient();

  let rxNormCodeToStringMap: Record<string, RxNormToNdcAttributes>;
  let remainingParts = 2;
  createReadStream(archivePath)
    .pipe(unzip.Parse())
    .pipe(
      new Transform({
        objectMode: true,
        transform: async (entry: unzip.Entry, _, done: TransformCallback) => {
          if (entry.type !== "File" || entry.size === 0) {
            entry.autodrain();
            return done();
          }

          const filePath = entry.path as string;
          if (filePath.endsWith("/RXNCONSO.RRF")) {
            console.log("Generating the concepts map...");
            rxNormCodeToStringMap = await processConcepts(entry);
            console.log("Finished... Let's look at what we got");
            console.log("\n");
            remainingParts--;
          } else if (filePath.endsWith("/RXNSAT.RRF")) {
            if (!rxNormCodeToStringMap) {
              return done(
                new Error("Expected to read concepts (MRCONSO.RRF) before properties (MRSAT.RRF)")
              );
            }
            console.log("Importing concept properties...");
            await processProperties(entry, rxNormCodeToStringMap);
            console.log("\n");
            remainingParts--;
          } else {
            console.log(`Skipping file ${filePath}`);
            entry.autodrain();
          }
          if (remainingParts === 0) {
            console.log("Finished processing all files");
            done();
          } else {
            done();
          }
        },
      })
        .on("finish", async () => {
          try {
            console.log("Uploading RxNorm to NDC mappings to database...");
            await sendRxNormToNdcMappings(rxNormCodeToStringMap, client);
            console.log("Successfully uploaded all mappings");

            console.log("Creating RxNorm-NDC crosswalks...");
            await createRxNormNdcCrosswalks(rxNormCodeToStringMap, client);
            console.log("Successfully created all crosswalks");

            resolve();
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })
        .on("error", err => {
          return err instanceof EOF ? resolve() : reject(err);
        })
    );
  return result;
}

async function processConcepts(inStream: Readable): Promise<Record<string, RxNormToNdcAttributes>> {
  const rl = createInterface(inStream);
  const mappedConcepts: Record<string, RxNormToNdcAttributes> = Object.create(null);

  for await (const line of rl) {
    const concept = new UmlsConcept(line);
    const source = concept.SAB;
    if (source !== ndcSource.name) {
      // Ignore unknown code system
      continue;
    } else if (concept.LAT !== "ENG") {
      // Ignore non-English
      continue;
    } else if (!ndcSource.tty.includes(concept.TTY)) {
      // Use only preferred term types for the display string
      continue;
    } else if (concept.SUPPRESS !== "N") {
      // Skip suppressible terms
      continue;
    }

    const existingConcept = mappedConcepts[concept.AUI];
    if (existingConcept) {
      const priority = ndcSource.tty.indexOf(concept.TTY);
      const existingPriority = ndcSource.tty.indexOf(existingConcept.tty);
      if (priority <= existingPriority) {
        // Skip if new concept has lower or equal priority
        continue;
      }
    }

    // Only create/update the concept if it doesn't exist or has higher priority
    mappedConcepts[concept.AUI] = {
      description: concept.STR,
      rxNormCode: concept.AUI,
      ndcCodes: [],
      tty: concept.TTY,
    };
  }

  console.log(`==============================`);
  return mappedConcepts;
}

async function processProperties(
  inStream: Readable,
  rxNormCodeToStringMap: Record<string, RxNormToNdcAttributes>
): Promise<void> {
  console.log("\n");
  const rl = createInterface(inStream);

  let processed = 0;
  let skipped = 0;

  for await (const line of rl) {
    const attr = new UmlsAttribute(line);
    const targetSystem = attr.ATN;
    if (targetSystem !== "NDC") {
      continue;
    }

    const source = attr.SAB;
    if (source !== ndcSource.name) {
      // Ignore unknown code system
      continue;
    } else if (attr.SUPPRESS !== "N") {
      // Skip suppressible terms
      continue;
    }

    const existing = rxNormCodeToStringMap[attr.AUI];
    if (existing) {
      rxNormCodeToStringMap[attr.AUI] = {
        ...existing,
        ndcCodes: [...existing.ndcCodes, attr.ATV],
      };
      processed++;
    } else {
      skipped++;
    }
  }

  console.log(`Processed ${fmtNum(processed)} properties`);
  console.log(`Skipped ${fmtNum(skipped)} properties`);
  console.log(`==============================`);
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { useGrouping: true }).format(n);
}

if (require.main === module) {
  main()
    .then(() => console.log("Done!"))
    .catch(console.error);
}
