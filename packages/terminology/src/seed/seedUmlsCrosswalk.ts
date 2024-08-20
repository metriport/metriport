import { ConceptMap, Parameters } from "@medplum/fhirtypes";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { argv } from "node:process";
import { Readable, Transform, TransformCallback } from "node:stream";
import * as unzip from "unzip-stream";
import { TerminologyClient } from "../client";

const IFA_RULE_REGEX = /^IFA \d+ &#x7C;/;

class EOF extends Error {
  message = "<EOF>";
}

type UmlsConceptMapConfig = {
  system: string;
  target: string;
};

const C5885096: UmlsConceptMapConfig = {
  system: "http://snomed.info/sct",
  target: "http://hl7.org/fhir/sid/icd-10-cm",
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

function createLookupParameters(system: string, code: string): Parameters {
  return {
    resourceType: "Parameters",
    parameter: [
      { name: "system", valueUri: system },
      { name: "code", valueCode: code },
    ],
  };
}

async function createConceptMap({
  concept,
  config,
  sourceDisplay,
  targetDisplay,
}: {
  concept: UmlsConceptMap;
  config: UmlsConceptMapConfig;
  sourceDisplay: string | undefined;
  targetDisplay: string | undefined;
}): Promise<ConceptMap> {
  return {
    resourceType: "ConceptMap",
    status: "active",
    group: [
      {
        source: config.system,
        target: config.target,
        element: [
          {
            code: concept.FROMID,
            display: sourceDisplay,
            target: [
              {
                code: concept.TOID,
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
}: {
  umlsConcept: UmlsConceptMap;
  conceptMap: ConceptMap;
  targetDisplay: string | undefined;
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
                    code: umlsConcept.TOID,
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

  // const counts = Object.create(null) as Record<string, number>;
  // const codings = Object.create(null) as Record<string, Coding[]>;
  const mappedConcepts: Record<string, ConceptMap> = Object.create(null);
  for await (const line of rl) {
    const concept = new UmlsConceptMap(line);
    if (concept.MAPSETCUI != "C5885096") {
      continue;
    }
    if (concept.MAPRULE && IFA_RULE_REGEX.test(concept.MAPRULE)) {
      continue;
    }
    if (concept.REL != "RO") {
      continue;
    }

    const key = concept.MAPSETCUI + "|" + concept.FROMID;
    const updatedConcept = {
      ...concept,
      TOID: concept.TOID.endsWith("?") ? concept.TOID.slice(0, -1) + "A" : concept.TOID,
    };

    const sourceParameters = createLookupParameters(C5885096.system, updatedConcept.FROMID);
    const sourceLookup = await client.lookupCode(sourceParameters);
    const sourceDisplay = Array.isArray(sourceLookup) ? undefined : sourceLookup.display;

    const targetParameters = createLookupParameters(C5885096.target, updatedConcept.TOID);
    const targetLookup = await client.lookupCode(targetParameters);
    const targetDisplay = Array.isArray(targetLookup) ? undefined : targetLookup.display;

    if (!mappedConcepts[key]) {
      mappedConcepts[key] = await createConceptMap({
        concept: updatedConcept,
        config: C5885096,
        sourceDisplay,
        targetDisplay,
      });
    } else {
      mappedConcepts[key] = updateConceptMap({
        umlsConcept: updatedConcept,
        conceptMap: mappedConcepts[key],
        targetDisplay,
      });
    }
  }
  for (const conceptMap of Object.values(mappedConcepts)) {
    try {
      await client.importConceptMap(conceptMap);
    } catch (error) {
      console.log(`Error importing concept map: ${error}`);
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
