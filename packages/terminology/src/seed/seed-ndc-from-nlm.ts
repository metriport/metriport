import { ConceptMap, Parameters } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import { createReadStream } from "node:fs";
import { argv } from "node:process";
import { createInterface } from "node:readline";
import { Readable, Transform, TransformCallback } from "node:stream";
import * as unzip from "unzip-stream";
import { TerminologyClient } from "../client";
import { rxnorm } from "../operations/definitions/codeSystem";
import { UmlsAttribute, UmlsConcept, umlsSources } from "./classes";
import { lookupDisplay, sendParameters } from "./shared";

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
class EOF extends Error {
  message = "<EOF>";
}

type RxNormToNdcMapping = {
  display: string;
  rxNormCode: string;
  ndcCodings: {
    code: string;
    display?: string;
  }[];
  tty: string;
};

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

  const rxNormCodeToStringMap: Record<string, RxNormToNdcMapping> = Object.create(null);
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
            await fillMapWithRxNormAttributes(entry, rxNormCodeToStringMap);
            remainingParts--;
          } else if (filePath.endsWith("/RXNSAT.RRF")) {
            if (!rxNormCodeToStringMap) {
              return done(
                new Error("Expected to read concepts (MRCONSO.RRF) before properties (MRSAT.RRF)")
              );
            }
            await fillMapWithNdcMappings(entry, rxNormCodeToStringMap);
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
            await sendRxNormToNdcMappings(rxNormCodeToStringMap, client);
            await createRxNormNdcCrosswalks(rxNormCodeToStringMap, client);
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

async function fillMapWithRxNormAttributes(
  inStream: Readable,
  conceptsMap: Record<string, RxNormToNdcMapping>
): Promise<Record<string, RxNormToNdcMapping>> {
  console.log("Generating the concepts map...");
  const rl = createInterface(inStream);

  for await (const line of rl) {
    const concept = new UmlsConcept(line);
    const source = umlsSources[concept.SAB];
    if (!source || source.system !== rxnorm.url) {
      // Ignore non-RxNorm concepts
      continue;
    } else if (concept.LAT !== "ENG") {
      // Ignore non-English
      continue;
    } else if (!source.tty.includes(concept.TTY)) {
      // Use only preferred term types for the display string
      continue;
    } else if (concept.SUPPRESS !== "N") {
      // Skip suppressible terms
      continue;
    }

    const existingConcept = conceptsMap[concept.CODE];
    if (existingConcept) {
      const priority = umlsSources["NDC"].tty.indexOf(concept.TTY);
      const existingPriority = umlsSources["NDC"].tty.indexOf(existingConcept.tty);
      if (priority <= existingPriority) {
        // Skip if new concept has lower or equal priority
        continue;
      }
    }

    conceptsMap[concept.CODE] = {
      display: concept.STR,
      rxNormCode: concept.CODE,
      tty: concept.TTY,
      ndcCodings: [], // There are no NDC codes in this file
    };
  }

  console.log(`==============================`);
  console.log(`Finished... We've got ${Object.keys(conceptsMap).length} RxNorm concepts.\n`);
  return conceptsMap;
}

async function sendRxNormToNdcMappings(
  mappings: Record<string, RxNormToNdcMapping>,
  client: TerminologyClient
): Promise<void> {
  console.log("Uploading NDC codes to the database...");

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
          if (!attributes.ndcCodings.length) {
            return [];
          }

          return attributes.ndcCodings.map(ndcCode => ({
            name: "concept",
            valueCoding: {
              code: ndcCode.code,
              // Use the RxNorm display as the NDC display. The NDC displays for all existing codes should already be in the database from the previous seeding step
              display: attributes.display,
            },
          }));
        }),
      ],
    } as Parameters;

    await sendParameters(parameters, client, false);
    console.log(`Processed batch ${index + 1}/${batches.length}`);
  }

  console.log("Successfully uploaded all mappings");
}

async function createRxNormNdcCrosswalks(
  rxNormCodeToStringMap: Record<string, RxNormToNdcMapping>,
  client: TerminologyClient
): Promise<void> {
  console.log("Creating RxNorm-NDC crosswalks...");

  const rxNormToNdcEntries = Object.entries(rxNormCodeToStringMap);
  const totalMappings = rxNormToNdcEntries.reduce(
    (acc, [, mapping]) => acc + mapping.ndcCodings.length,
    0
  );
  let processedMappings = 0;

  for (const [key, mapping] of rxNormToNdcEntries) {
    if (!mapping.ndcCodings.length) {
      continue;
    }

    for (const ndcCode of mapping.ndcCodings) {
      const ndcToRxNormMap = {
        ...ndcToRxNormTemplateMap,
        ...(ndcToRxNormTemplateMap.group?.[0]
          ? {
              group: [
                {
                  ...ndcToRxNormTemplateMap.group[0],
                  element: [
                    {
                      code: ndcCode.code,
                      display: ndcCode.display,
                      target: [
                        {
                          code: mapping.rxNormCode,
                          display: mapping.display,
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

  console.log("Successfully created all crosswalks.\n");
}

async function fillMapWithNdcMappings(
  inStream: Readable,
  rxNormCodeToStringMap: Record<string, RxNormToNdcMapping>
): Promise<void> {
  console.log("Adding the NDC mappings from crosswalks...");
  const client = new TerminologyClient();

  // Convert stream to array of lines first
  const rl = createInterface(inStream);

  let processed = 0;
  let skipped = 0;

  for await (const line of rl) {
    const attr = new UmlsAttribute(line);
    // ATN is target system name (i.e. NDC)
    const targetSystem = attr.ATN;
    if (targetSystem !== "NDC") {
      skipped++;
      continue;
    }

    const source = umlsSources[attr.SAB];
    if (!source || source.system !== rxnorm.url) {
      // Ignore non-RxNorm concepts
      skipped++;
      continue;
    } else if (attr.SUPPRESS !== "N") {
      // Skip suppressible terms
      skipped++;
      continue;
    }

    const existing = rxNormCodeToStringMap[attr.CODE];
    if (existing) {
      const ndcDisplay = await lookupDisplay(client, umlsSources["NDC"].system, attr.ATV);
      rxNormCodeToStringMap[attr.CODE] = {
        ...existing,
        // ATV is target system code (i.e. NDC code)
        ndcCodings: [
          ...existing.ndcCodings,
          {
            code: attr.ATV,
            ...(ndcDisplay ? { display: ndcDisplay } : {}),
          },
        ],
      };
      processed++;
      if (processed % 1000 === 0) {
        await sleep(100);
        console.log(`Processed ${fmtNum(processed)} properties`);
      }
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
