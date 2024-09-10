import { Observation, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import {
  bodySiteColumns,
  category0Columns,
  category1Columns,
  codeColumns,
  effectiveDateTimeColumns,
  effectivePeriodColumns,
  getBodySite,
  getCategories,
  getCode,
  getEffectiveDateTime,
  getEffectivePeriod,
  getInterpretation,
  getNotes,
  getRefRange,
  getValueCodeableConcept,
  interpretationColumns,
  notesColumns,
  refRangeColumns,
  valueCodeableConceptColumns,
} from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/observation.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  ...category0Columns,
  ...category1Columns,
  ...codeColumns,
  "subjRef",
  "subjRef_s",
  "encounterRef",
  "encounterRef_s",
  ...effectiveDateTimeColumns,
  ...effectivePeriodColumns,
  "perfActorRef0",
  "perfActorRef0_s",
  "perfActorRef1",
  "perfActorRef1_s",
  "perfActorRef2",
  "perfActorRef2_s",
  "perfActorRef3",
  "perfActorRef3_s",
  "valQtty",
  "valQtty_s",
  ...valueCodeableConceptColumns,
  "valString",
  "valString_s",
  ...interpretationColumns,
  ...notesColumns,
  ...bodySiteColumns,
  ...refRangeColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processObservation(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Observation[] = (originalDic.Observation ?? []).flatMap(
    r => (r as Observation) ?? []
  );
  const dedup: Observation[] = (dedupDic.Observation ?? []).flatMap(r => (r as Observation) ?? []);

  const originalFileName = patientDirName + `/Observation-original.csv`;
  const dedupFileName = patientDirName + `/Observation-dedup.csv`;

  const header = columns.join(csvSeparator);
  fs.writeFileSync(originalFileName, header + "\n");
  fs.writeFileSync(dedupFileName, header + "\n");

  const originalCsv = original
    .sort(sort)
    .map(m => toCsv(m, dedup))
    .join("\n");
  const dedupCsv = dedup
    .sort(sort)
    .map(m => toCsv(m, original))
    .join("\n");

  fs.writeFileSync(originalFileName, originalCsv, { flag: "a+" });
  fs.writeFileSync(dedupFileName, dedupCsv, { flag: "a+" });
}

function sort(a: Observation, b: Observation): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Observation, others: Observation[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const perfActorRef0 = resource.performer?.[0]?.reference ?? "";
  const perfActorRef1 = resource.performer?.[1]?.reference ?? "";
  const perfActorRef2 = resource.performer?.[2]?.reference ?? "";
  const perfActorRef3 = resource.performer?.[3]?.reference ?? "";
  const valQtty = resource.valueQuantity?.value ?? "";
  const valString = resource.valueString ?? "";

  const status_s = firstSibling?.status ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const perfActorRef0_s = firstSibling?.performer?.[0]?.reference ?? "";
  const perfActorRef1_s = firstSibling?.performer?.[1]?.reference ?? "";
  const perfActorRef2_s = firstSibling?.performer?.[2]?.reference ?? "";
  const perfActorRef3_s = firstSibling?.performer?.[3]?.reference ?? "";
  const valQtty_s = firstSibling?.valueQuantity?.value ?? "";
  const valString_s = firstSibling?.valueString ?? "";

  const category = getCategories(resource, firstSibling);
  const effectiveDateTime = getEffectiveDateTime(resource, firstSibling);
  const effectivePeriod = getEffectivePeriod(resource, firstSibling);
  const code = getCode(resource, firstSibling);
  const valueCodeableConcept = getValueCodeableConcept(resource, firstSibling);
  const interpretation = getInterpretation(resource, firstSibling);
  const notes = getNotes(resource, firstSibling);
  const bodySite = getBodySite(resource, firstSibling);
  const refRange = getRefRange(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    ...category,
    ...code,
    subjRef,
    subjRef_s,
    encounterRef,
    encounterRef_s,
    perfActorRef0,
    perfActorRef0_s,
    perfActorRef1,
    perfActorRef1_s,
    perfActorRef2,
    perfActorRef2_s,
    perfActorRef3,
    perfActorRef3_s,
    valQtty,
    valQtty_s,
    ...valueCodeableConcept,
    valString,
    valString_s,
    ...effectiveDateTime,
    ...effectivePeriod,
    ...interpretation,
    ...notes,
    ...bodySite,
    ...refRange,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
