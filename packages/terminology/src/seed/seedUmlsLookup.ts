// Licensed under Apache. See LICENSE-APACHE in the repo root for license information.
import { Coding, Parameters } from "@medplum/fhirtypes";
import { WriteStream, createReadStream } from "node:fs";
import { argv, env } from "node:process";
import { createInterface } from "node:readline";
import { Readable, Transform, TransformCallback } from "node:stream";
import * as unzip from "unzip-stream";
import { TerminologyClient } from "../client";
import { UmlsAttribute, UmlsConcept, UmlsSource, umlsSources } from "./classes";
import { sendParameters } from "./shared";

/**
 * This utility generates data for CodeSystem resources from the UMLS Metathesaurus.
 *
 * The source files provided by UMLS are quite large (GB+) and are not included in this repository.
 *
 * The objective of this utility is to generate a subset of the UMLS that is useful for the Medplum FHIR server.
 *
 * Requirements:
 *
 * - Download the UMLS Metathesaurus from https://www.nlm.nih.gov/research/umls/licensedcontent/umlsknowledgesources.html
 *
 * Most recently verified with the 2023AB release in January 2024.
 *
 * References:
 *
 * UMLS Metathesaurus Vocabulary Documentation
 * https://www.nlm.nih.gov/research/umls/sourcereleasedocs/index.html
 *
 * UMLS Release Documentation
 * https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/index.html
 *
 * Columns and Data Elements
 * https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/columns_data_elements.html
 *
 * Abbreviations Used in Data Elements
 * https://www.nlm.nih.gov/research/umls/knowledge_sources/metathesaurus/release/abbreviations.html
 */

class EOF extends Error {
  message = "<EOF>";
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

  let mappedCodes: Record<string, UmlsConcept>;
  let relationshipProperties: Record<string, string>;
  let remainingParts = 4;
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
          if (filePath.endsWith("/MRCONSO.RRF")) {
            console.log("Importing concepts...");
            mappedCodes = await processConcepts(entry, client);
            console.log("\n");
            remainingParts--;
          } else if (filePath.endsWith("/MRDOC.RRF")) {
            relationshipProperties = await prepareRelationshipProperties(entry);
            console.log(
              `Mapped ${Object.keys(relationshipProperties).length} relationship properties`
            );
            remainingParts--;
          } else if (filePath.endsWith("/MRREL.RRF")) {
            if (!mappedCodes) {
              return done(
                new Error(
                  "Expected to read concepts (MRCONSO.RRF) before relationships (MRREL.RRF)"
                )
              );
            } else if (!relationshipProperties) {
              return done(
                new Error(
                  "Expected to read property definitions (MRDOC.RRF) before relationships (MRREL.RRF)"
                )
              );
            }
            console.log("Importing relationship properties...");
            await processRelationships(entry, relationshipProperties, mappedCodes, client);
            console.log("\n");
            remainingParts--;
          } else if (filePath.endsWith("/MRSAT.RRF")) {
            if (!mappedCodes) {
              return done(
                new Error("Expected to read concepts (MRCONSO.RRF) before properties (MRSAT.RRF)")
              );
            }
            console.log("Importing concept properties...");
            await processProperties(entry, client);
            console.log("\n");
            remainingParts--;
          } else {
            console.log(`Skipping file ${filePath}`);
            entry.autodrain();
          }
          return remainingParts > 0 ? done() : done(new EOF());
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

async function processConcepts(
  inStream: Readable,
  client: TerminologyClient
): Promise<Record<string, UmlsConcept>> {
  const rl = createInterface(inStream);

  let processed = 0;
  let skipped = 0;
  const counts = Object.create(null) as Record<string, number>;
  const codings = Object.create(null) as Record<string, Coding[]>;
  const mappedConcepts: Record<string, UmlsConcept> = Object.create(null);

  for await (const line of rl) {
    const concept = new UmlsConcept(line);
    const source = umlsSources[concept.SAB];
    if (!source) {
      // Ignore unknown code system
      continue;
    } else if (concept.LAT !== "ENG") {
      // Ignore non-English
      continue;
    } else if (!source.tty.includes(concept.TTY)) {
      // Use only preferred term types for the display string
      continue;
    } else if (concept.SUPPRESS !== "N") {
      // Skip suppressible terms
      skipped++;
      continue;
    }

    mappedConcepts[concept.AUI] = concept; // Map all term types for future reference
    const existingConcept = mappedConcepts[concept.SAB + "|" + concept.CODE];
    if (existingConcept) {
      const priority = source.tty.indexOf(concept.TTY);
      const existingPriority = source.tty.indexOf(existingConcept.TTY);
      if (priority >= existingPriority) {
        // Ignore less-preferred term types
        continue;
      }
    } else {
      // Count the first occurrence of each code in the system
      counts[source.system] = (counts[source.system] ?? 0) + 1;
    }
    mappedConcepts[concept.SAB + "|" + concept.CODE] = concept;

    const coding = { code: concept.CODE, display: concept.STR };
    let foundCodings = codings[source.system];
    if (foundCodings) {
      foundCodings.push(coding);
    } else {
      foundCodings = [coding];
    }

    if (foundCodings.length >= 500) {
      await sendCodings(foundCodings, source.system, client);
      codings[source.system] = [];
    } else {
      codings[source.system] = foundCodings;
    }
    processed++;
  }

  for (const [system, foundCodings] of Object.entries(codings)) {
    if (foundCodings.length > 0) {
      await sendCodings(foundCodings, system, client);
    }
  }
  console.log(`Processed ${fmtNum(processed)} entries`);
  console.log(`(skipped ${fmtNum(skipped)})`);
  console.log(`==============================`);
  for (const [systemUrl, count] of Object.entries(counts).sort((l, r) => r[1] - l[1])) {
    console.log(`${systemUrl}: ${fmtNum(count)}`);
  }
  return mappedConcepts;
}

async function sendCodings(
  codings: Coding[],
  system: string,
  client: TerminologyClient,
  file?: WriteStream
): Promise<void> {
  const parameters = {
    resourceType: "Parameters",
    parameter: [
      { name: "system", valueUri: system },
      ...codings.map(c => ({ name: "concept", valueCoding: c })),
    ],
  } as Parameters;
  await sendParameters(parameters, client);

  if (file) {
    file.write(JSON.stringify(parameters) + "\n");
  }

  if (env.DEBUG) {
    console.log(
      `Processed ${(parameters.parameter?.length ?? 0) - 1} ${system} codings, ex:`,
      parameters.parameter?.[1]
    );
  }
}

class UmlsDoc {
  /** Data element or attribute. */
  readonly DOCKEY: string;
  /** Abbreviation that is one of its values. */
  readonly VALUE: string;
  /** Type of information in EXPL column. */
  readonly TYPE: string;
  /** Explanation of VALUE. */
  readonly EXPL: string;

  constructor(line: string) {
    [this.DOCKEY, this.VALUE, this.TYPE, this.EXPL] = line.split("|");
  }
}

async function prepareRelationshipProperties(inStream: Readable): Promise<Record<string, string>> {
  const rl = createInterface(inStream);

  const propertyMappings: Record<
    string,
    {
      rel?: string;
      rela?: string;
    }
  > = Object.create(null);
  for await (const line of rl) {
    const doc = new UmlsDoc(line);
    if (doc.DOCKEY === "REL" && doc.TYPE === "snomedct_rel_mapping") {
      propertyMappings[doc.VALUE] = { ...propertyMappings[doc.VALUE], rel: doc.EXPL };
    } else if (doc.DOCKEY === "RELA" && doc.TYPE === "snomedct_rela_mapping") {
      propertyMappings[doc.VALUE] = { ...propertyMappings[doc.VALUE], rela: doc.EXPL };
    }
  }
  return Object.fromEntries(
    Object.entries(propertyMappings).map(([property, { rel, rela }]) => [
      `SNOMEDCT_US/${rel ?? ""}/${rela ?? ""}`,
      property,
    ])
  );
}

const mappedProperties: Record<string, string> = {
  LOINC_COMPONENT: "COMPONENT",
  LOINC_METHOD_TYP: "METHOD_TYP",
  LOINC_PROPERTY: "PROPERTY",
  LOINC_SCALE_TYP: "SCALE_TYP",
  LOINC_SYSTEM: "SYSTEM",
  LOINC_TIME_ASPECT: "TIME_ASPCT",
  LOR: "ORDER_OBS",
  LQS: "SURVEY_QUEST_SRC",
  LQT: "SURVEY_QUEST_TEXT",
  LRN2: "RELATEDNAMES2",
  LCL: "CLASS",
  LCN: "CLASSTYPE",
  LCS: "STATUS",
  LCT: "CHNG_TYPE",
  LEA: "EXMPL_ANSWERS",
  LFO: "FORMULA",
  LMP: "MAP_TO",
  LUR: "UNITSREQUIRED",
  LC: "LONG_COMMON_NAME",
};

type Property = {
  code: string;
  property: string;
  value: string;
};

async function processProperties(inStream: Readable, client: TerminologyClient): Promise<void> {
  const rl = createInterface(inStream);

  let processed = 0;
  let skipped = 0;
  const counts = Object.create(null) as Record<string, number>;
  const properties: Record<string, Property[]> = Object.create(null);

  for await (const line of rl) {
    const attr = new UmlsAttribute(line);
    const source = umlsSources[attr.SAB];
    if (!source) {
      // Ignore unknown code system
      continue;
    } else if (attr.SUPPRESS !== "N") {
      // Skip suppressible terms
      skipped++;
      continue;
    }

    const property = source?.resource?.property?.find(
      p => attr.ATN === p.code || mappedProperties[attr.ATN] === p.code
    );
    if (!property) {
      // Ignore unknown property
      continue;
    }
    const prop = { code: attr.CODE, property: property.code as string, value: attr.ATV };
    let foundProperties = properties[source.system];
    if (foundProperties) {
      foundProperties.push(prop);
    } else {
      foundProperties = [prop];
    }

    if (foundProperties.length >= 500) {
      await sendProperties(foundProperties, source.system, client);
      properties[source.system] = [];
    } else {
      properties[source.system] = foundProperties;
    }

    const key = `${source.system}|${property.code}`;
    counts[key] = (counts[key] ?? 0) + 1;
    processed++;
  }

  for (const [system, foundProperties] of Object.entries(properties)) {
    if (foundProperties.length > 0) {
      await sendProperties(foundProperties, system, client);
    }
  }

  console.log(`Found ${fmtNum(processed)} code properties`);
  console.log(`(skipped ${fmtNum(skipped)})`);
  console.log(`==============================`);
  for (const [property, count] of Object.entries(counts).sort(groupCounts)) {
    console.log(`${property}: ${fmtNum(count)}`);
  }
}

/**
 * Sort function used to group properties by system.
 * @param l - Left entry.
 * @param r - Right entry.
 * @returns Sort ordering.
 */
function groupCounts(l: [string, number], r: [string, number]): number {
  return r[0].split("|", 1)[0].localeCompare(l[0].split("|", 1)[0]) || r[1] - l[1];
}

/** @see https://www.ncbi.nlm.nih.gov/books/NBK9685/table/ch03.T.related_concepts_file_mrrel_rrf */
class UmlsRelationship {
  /** Unique identifier of first concept. */
  readonly CUI1: string;
  /** Unique identifier of first atom. */
  readonly AUI1: string;
  /**
   * The name of the column in MRCONSO.RRF that contains the identifier used for the first element in the relationship,
   * i.e. AUI, CODE, CUI, SCUI, SDUI.
   */
  readonly STYPE1: string;
  /** Relationship of second concept or atom to first concept or atom. */
  readonly REL: string;
  /** Unique identifier of second concept. */
  readonly CUI2: string;
  /** Unique identifier of second atom. */
  readonly AUI2: string;
  /**
   * The name of the column in MRCONSO.RRF that contains the identifier used for the second element in the relationship,
   * i.e. AUI, CODE, CUI, SCUI, SDUI.
   */
  readonly STYPE2: string;
  /** Additional (more specific) relationship label (optional). */
  readonly RELA: string;
  /** Unique identifier of relationship. */
  readonly RUI: string;
  /** Source asserted relationship identifier, if present. */
  readonly SRUI: string;
  /**
   * Source abbreviation.  This uniquely identifies the underlying source vocabulary.
   *
   * @see https://www.nlm.nih.gov/research/umls/sourcereleasedocs/index.html
   */
  readonly SAB: string;
  /** Source of relationship labels. */
  readonly SL: string;
  /** Relationship group. Used to indicate that a set of relationships should be looked at in conjunction. */
  readonly RG: string;
  /**
   * Source asserted directionality flag.
   *
   * 'Y' indicates that this is the direction of the relationship in its source; 'N' indicates that it is not;
   * a blank indicates that it is not important or has not yet been determined.
   */
  readonly DIR: string;
  /**
   * Suppressible flag.
   *
   * O = All obsolete content, whether they are obsolesced by the source or by NLM
   * E = Non-obsolete content marked suppressible by an editor
   * Y = Non-obsolete content deemed suppressible during inversion
   * N = None of the above (not suppressible)
   */
  readonly SUPPRESS: string;

  constructor(line: string) {
    [
      this.CUI1,
      this.AUI1,
      this.STYPE1,
      this.REL,
      this.CUI2,
      this.AUI2,
      this.STYPE2,
      this.RELA,
      this.RUI,
      this.SRUI,
      this.SAB,
      this.SL,
      this.RG,
      this.DIR,
      this.SUPPRESS,
    ] = line.split("|");
  }
}

const PARENT_PROPERTY = "http://hl7.org/fhir/concept-properties#parent";
const CHILD_PROPERTY = "http://hl7.org/fhir/concept-properties#child";

async function processRelationships(
  inStream: Readable,
  relationshipProperties: Record<string, string>,
  mappedCodes: Record<string, UmlsConcept>,
  client: TerminologyClient
): Promise<void> {
  const rl = createInterface(inStream);

  let processed = 0;
  let skipped = 0;
  const counts = Object.create(null) as Record<string, number>;
  const properties: Record<string, Property[]> = Object.create(null);

  for await (const line of rl) {
    const rel = new UmlsRelationship(line);
    const source = umlsSources[rel.SAB];
    if (!source) {
      // Ignore unknown code system
      continue;
    } else if (rel.SUPPRESS !== "N") {
      skipped++;
      continue;
    }

    const property = resolveRelationship(rel, source, mappedCodes, relationshipProperties);
    if (!property) {
      skipped++;
      continue;
    }
    let foundProperties = properties[source.system];
    if (foundProperties) {
      foundProperties.push(property);
    } else {
      foundProperties = [property];
    }

    if (foundProperties.length >= 500) {
      await sendProperties(foundProperties, source.system, client);
      properties[source.system] = [];
    } else {
      properties[source.system] = foundProperties;
    }

    const key = `${source.system}|${property.code} (${rel.REL}/${rel.RELA})`;
    counts[key] = (counts[key] ?? 0) + 1;
    processed++;
  }

  for (const [system, foundProperties] of Object.entries(properties)) {
    if (foundProperties.length > 0) {
      await sendProperties(foundProperties, system, client);
    }
  }

  console.log(`Found ${fmtNum(processed)} relationship properties`);
  console.log(`(skipped ${fmtNum(skipped)})`);
  console.log(`==============================`);
  for (const [property, count] of Object.entries(counts).sort(groupCounts)) {
    console.log(`${property}: ${fmtNum(count)}`);
  }
}

function resolveRelationship(
  rel: UmlsRelationship,
  source: UmlsSource,
  mappedCodes: Record<string, UmlsConcept>,
  relationshipProperties: Record<string, string>
): Property | undefined {
  const mappedPropertyName = relationshipProperties[rel.SAB + "/" + rel.REL + "/" + rel.RELA];
  let propertyName: string | undefined;
  if (mappedPropertyName) {
    propertyName = mappedPropertyName;
  } else if (rel.REL === "PAR") {
    propertyName = source.resource.property?.find(p => p.uri === PARENT_PROPERTY)?.code;
  } else if (rel.REL === "CHD") {
    propertyName = source.resource.property?.find(p => p.uri === CHILD_PROPERTY)?.code;
  }
  if (!propertyName) {
    // Ignore unknown property
    return undefined;
  } else if (!source.resource.property?.find(p => p.code === propertyName)) {
    // Ignore unsupported property
    return undefined;
  }

  const code = mappedCodes[rel.AUI1]?.CODE;
  const value = mappedCodes[rel.AUI2]?.CODE;
  if (!code || !value) {
    console.warn(
      "Skipping relationship with missing atom:",
      propertyName,
      rel.REL + "/" + rel.RELA,
      code ? rel.AUI2 : rel.AUI1
    );
    return undefined;
  }

  return { code, property: propertyName, value };
}

async function sendProperties(
  properties: Property[],
  system: string,
  client: TerminologyClient,
  file?: WriteStream
): Promise<void> {
  const parameters = {
    resourceType: "Parameters",
    parameter: [
      { name: "system", valueUri: system },
      ...properties.map(p => ({
        name: "property",
        part: [
          { name: "code", valueCode: p.code },
          { name: "property", valueCode: p.property },
          { name: "value", valueString: p.value },
        ],
      })),
    ],
  } as Parameters;
  await sendParameters(parameters, client);

  if (file) {
    file.write(JSON.stringify(parameters) + "\n");
  }

  if (env.DEBUG) {
    console.log(
      `Processed ${(parameters.parameter?.length ?? 0) - 1} ${system} properties, ex:`,
      parameters.parameter?.[1]
    );
  }
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("en-US", { useGrouping: true }).format(n);
}

if (require.main === module) {
  main()
    .then(() => console.log("Done!"))
    .catch(console.error);
}
