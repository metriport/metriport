import { ConceptMap } from "@medplum/fhirtypes";
import { createReadStream } from "node:fs";
import { argv } from "node:process";
import { createInterface } from "node:readline";
import { Readable, Transform, TransformCallback } from "node:stream";
import * as unzip from "unzip-stream";
import { TerminologyClient } from "../client";
import { createLookupParameters, lookupDisplay } from "./shared";

const IFA_RULE_REGEX = /^IFA \d+ &#x7C;/;

class EOF extends Error {
  message = "<EOF>";
}

type UmlsConceptMapConfig = {
  source: string;
  target: string;
};

/**
 * Configuration for UMLS mapping sets.
 * Each MAPSETCUI (Mapping Set CUI) represents a specific type of mapping between code systems.
 * For example, C5979685 represents SNOMED CT to ICD-10-CM mappings.
 *
 * The MAPSETCUI values can be found in the UMLS documentation or by examining the MRMAP.RRF file.
 */
const CONCEPT_MAP_CONFIGS: Record<string, UmlsConceptMapConfig> = {
  C5979685: {
    source: "http://snomed.info/sct",
    target: "http://hl7.org/fhir/sid/icd-10-cm",
  },
};

/** @see https://www.ncbi.nlm.nih.gov/books/NBK9685/table/ch03.T.concept_names_and_sources_file_mr */
class UmlsConceptMap {
  /** Unique identifier for the UMLS concept which represents the whole map set.
   * This is what we use to choose which mappings we want to use.
   */
  readonly MAPSETCUI: string;
  /** Source abbreviation (SAB) for the provider of the map set.
   * i.e. This will let us know that the mapping is a SNOMEDCT_US mapping.
   */
  readonly MAPSETSAB: string;
  /** Map subset identifier used to identify a subset of related mappings within a map set. This is used for cases where the FROMEXPR may have more than one potential mapping (optional). */
  readonly MAPSUBSETID: string;
  /** Order in which mappings in a subset should be applied. Used only where MAPSUBSETID is used. (optional) */
  readonly MAPRANK?: string;
  /** Unique identifier for this individual mapping. Primary key of this table to identify a particular row. */
  readonly MAPID: string;
  /** Source asserted identifier for this mapping (optional). */
  readonly MAPSID?: string;
  /** Identifier for the entity being mapped from.
   *  This is the id in the source mapping system
   */
  readonly FROMID: string;
  /** Source asserted identifier for the entity being mapped from (optional). */
  readonly FROMSID?: string;
  /** Entity being mapped from - can be a single code/identifier /concept name or a complex expression involving multiple codes/identifiers/concept names, Boolean operators and/or punctuation */
  readonly FROMEXPR: string;
  /** Type of entity being mapped from. */
  readonly FROMTYPE?: string;
  /** Machine processable rule applicable to the entity being mapped from (optional) */
  readonly FROMRULE?: string;
  /** Restriction applicable to the entity being mapped from (optional). */
  readonly FROMRES?: string;
  /** Relationship of the entity being mapped from to the entity being mapped to. */
  readonly REL?: string;
  /** Additional relationship label (optional). */
  readonly RELA?: string;
  /** Identifier for the entity being mapped to.
   *  This is the in the target mapping system
   */
  TOID: string;
  /** Source asserted identifier for the entity being mapped to (optional). */
  readonly TOSID?: string;
  /** Entity being mapped to
   *  Same as TOID
   */
  readonly TOEXPR?: string;
  /** Type of entity being mapped to.
   * Almost always SDUI
   */
  readonly TOTYPE?: string;
  /** Machine processable rule applicable to the entity being mapped to (optional). */
  readonly TORULE?: string;
  /** Restriction applicable to the entity being mapped to (optional). */
  readonly TORES?: string;
  /** Machine processable rule applicable to this mapping (optional).
   *  Important condition
   */
  readonly MAPRULE: string;
  /** Restriction applicable to this mapping (optional). */
  readonly MAPRES: string;
  /** Type of mapping (optional). */
  readonly MAPTYPE?: string;
  /** The Content View Flag is a bit field used to indicate membership in a content view. */
  readonly CVF: string;

  constructor(line: string) {
    [
      this.MAPSETCUI,
      this.MAPSETSAB,
      this.MAPSUBSETID,
      this.MAPRANK,
      this.MAPID,
      this.MAPSID,
      this.FROMID,
      this.FROMSID,
      this.FROMEXPR,
      this.FROMTYPE,
      this.FROMRULE,
      this.FROMRES,
      this.REL,
      this.RELA,
      this.TOID,
      this.TOSID,
      this.TOEXPR,
      this.TOTYPE,
      this.TORULE,
      this.TORES,
      this.MAPRULE,
      this.MAPRES,
      this.MAPTYPE,
      this.CVF,
    ] = line.split("|");
  }

  toString(): string {
    return [
      this.MAPSETCUI,
      this.MAPSETSAB,
      this.MAPSUBSETID,
      this.MAPRANK,
      this.MAPID,
      this.MAPSID,
      this.FROMID,
      this.FROMSID,
      this.FROMEXPR,
      this.FROMTYPE,
      this.FROMRULE,
      this.FROMRES,
      this.REL,
      this.RELA,
      this.TOID,
      this.TOSID,
      this.TOEXPR,
      this.TOTYPE,
      this.TORULE,
      this.TORES,
      this.MAPRULE,
      this.MAPRES,
      this.MAPTYPE,
      this.CVF,
    ].join("|");
  }
}

async function createConceptMap({
  concept,
  config,
  sourceDisplay,
  targetDisplay,
  targetCode,
}: {
  concept: UmlsConceptMap;
  config: UmlsConceptMapConfig;
  sourceDisplay: string | undefined;
  targetDisplay: string | undefined;
  targetCode?: string | undefined;
}): Promise<ConceptMap> {
  return {
    resourceType: "ConceptMap",
    status: "active",
    group: [
      {
        source: config.source,
        target: config.target,
        element: [
          {
            code: concept.FROMID,
            display: sourceDisplay,
            target: [
              {
                code: targetCode ?? concept.TOID,
                display: targetDisplay,
                equivalence: "equivalent",
              },
            ],
          },
        ],
      },
    ],
  };
}

function updateConceptMap({
  umlsConcept,
  conceptMap,
  targetDisplay,
  targetCode,
}: {
  umlsConcept: UmlsConceptMap;
  conceptMap: ConceptMap;
  targetDisplay: string | undefined;
  targetCode?: string | undefined;
}): ConceptMap {
  return {
    ...conceptMap,
    group:
      conceptMap.group?.map(group => ({
        ...group,
        element: group.element?.map(element =>
          element.code === umlsConcept.FROMID
            ? {
                ...element,
                target: [
                  ...(element.target?.map(t => ({ ...t, equivalence: "narrower" as const })) ?? []),
                  {
                    code: targetCode ?? umlsConcept.TOID,
                    display: targetDisplay,
                    equivalence: "narrower",
                  },
                ],
              }
            : element
        ),
      })) ?? [],
  };
}

async function processConceptMap(inStream: Readable): Promise<void> {
  const rl = createInterface(inStream);
  const client = new TerminologyClient();

  const mappedConcepts: Record<string, ConceptMap> = Object.create(null);
  let processedCount = 0;
  let skippedCount = 0;

  for await (const line of rl) {
    const concept = new UmlsConceptMap(line);
    const config = CONCEPT_MAP_CONFIGS[concept.MAPSETCUI];

    if (!config) {
      skippedCount++;
      continue;
    }

    if (concept.MAPRULE && IFA_RULE_REGEX.test(concept.MAPRULE)) {
      skippedCount++;
      continue;
    }

    if (concept.REL != "RO") {
      skippedCount++;
      continue;
    }

    const key = concept.MAPSETCUI + "|" + concept.FROMID;
    const existingMap = mappedConcepts[key];

    try {
      const sourceDisplay = await lookupDisplay(client, config.source, concept.FROMID);

      if (concept.TOID.endsWith("?")) {
        const partialCode = concept.TOID.slice(0, -1);
        const partialTargetLookup = await client.lookupPartialCode(
          createLookupParameters(config.target, partialCode)
        );

        for (const partialTarget of partialTargetLookup) {
          const targetDisplay = partialTarget.display;
          const targetCode = partialTarget.code;

          if (existingMap) {
            mappedConcepts[key] = updateConceptMap({
              umlsConcept: concept,
              conceptMap: mappedConcepts[key],
              targetDisplay,
              targetCode,
            });
          } else {
            mappedConcepts[key] = await createConceptMap({
              concept,
              config,
              sourceDisplay,
              targetDisplay,
              targetCode,
            });
          }
        }
      } else {
        const targetDisplay = await lookupDisplay(client, config.target, concept.TOID);

        if (existingMap) {
          mappedConcepts[key] = updateConceptMap({
            umlsConcept: concept,
            conceptMap: mappedConcepts[key],
            targetDisplay,
          });
        } else {
          mappedConcepts[key] = await createConceptMap({
            concept,
            config,
            sourceDisplay,
            targetDisplay,
          });
        }
      }
      processedCount++;

      if (processedCount % 1000 === 0) {
        console.log(`Processed ${processedCount} mappings (skipped ${skippedCount})`);
      }
    } catch (error) {
      console.error(`Error processing mapping: ${error}`);
      skippedCount++;
    }
  }

  console.log(`\nProcessing complete:`);
  console.log(`- Processed: ${processedCount} mappings`);
  console.log(`- Skipped: ${skippedCount} mappings`);
  console.log(`- Total concept maps: ${Object.keys(mappedConcepts).length}`);

  // Import all concept maps
  for (const [key, conceptMap] of Object.entries(mappedConcepts)) {
    try {
      await client.importConceptMap(conceptMap, true);
      console.log(`Imported concept map for ${key}`);
    } catch (error) {
      console.error(`Error importing concept map for ${key}: ${error}`);
    }
  }
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

  createReadStream(archivePath)
    .pipe(unzip.Parse())
    .pipe(
      new Transform({
        objectMode: true,
        transform: async (entry: unzip.Entry, _, done: TransformCallback) => {
          const filePath = entry.path;
          if (filePath.endsWith("/MRMAP.RRF")) {
            console.log("Importing concepts...");
            await processConceptMap(entry);
            console.log("\n");
          }
          entry.autodrain(); // Ensure the entry is drained
          done();
        },
      })
        .on("finish", () => {
          resolve();
        })
        .on("error", err => {
          return err instanceof EOF ? resolve() : reject(err);
        })
    );
  return result;
}

main();
