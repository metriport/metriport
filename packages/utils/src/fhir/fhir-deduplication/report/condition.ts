import { Condition, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { bodySiteColumns, codeColumns, getBodySite, getCode } from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/condition.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "cliStat_code0",
  "cliStat_code0_s",
  "cliStat_disp0",
  "cliStat_disp0_s",
  "cliStat_code1",
  "cliStat_code1_s",
  "cliStat_disp1",
  "cliStat_disp1_s",
  "cliStat_text",
  "cliStat_text_s",
  "cat_code0",
  "cat_code0_s",
  "cat_disp0",
  "cat_disp0_s",
  "cat_code1",
  "cat_code1_s",
  "cat_disp1",
  "cat_disp1_s",
  "cat_text",
  "cat_text_s",
  ...codeColumns,
  ...bodySiteColumns,
  "subjRef",
  "subjRef_s",
  "encounterRef",
  "encounterRef_s",
  "onsetPeriod_start",
  "onsetPeriod_start_s",
  "onsetPeriod_end",
  "onsetPeriod_end_s",
  "recorderRef",
  "recorderRef_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processCondition(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Condition[] = (originalDic.Condition ?? []).flatMap(r => (r as Condition) ?? []);
  const dedup: Condition[] = (dedupDic.Condition ?? []).flatMap(r => (r as Condition) ?? []);

  const originalFileName = patientDirName + `/Condition-original.csv`;
  const dedupFileName = patientDirName + `/Condition-dedup.csv`;

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

function sort(a: Condition, b: Condition): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Condition, others: Condition[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  // set all fields necessary to populate the "res" object below, using resource and firstSibling, using the processMedicationStatement function as reference. Start with the properties that need "resource", then populate the ones that rely on "firstSibling".
  const cliStat_code0 = resource.clinicalStatus?.coding?.[0]?.code ?? "";
  const cliStat_disp0 = resource.clinicalStatus?.coding?.[0]?.display ?? "";
  const cliStat_code1 = resource.clinicalStatus?.coding?.[1]?.code ?? "";
  const cliStat_disp1 = resource.clinicalStatus?.coding?.[1]?.display ?? "";
  const cliStat_text = resource.clinicalStatus?.text ?? "";
  const cat_code0 = resource.category?.[0]?.coding?.[0]?.code ?? "";
  const cat_disp0 = resource.category?.[0]?.coding?.[0]?.display ?? "";
  const cat_code1 = resource.category?.[0]?.coding?.[1]?.code ?? "";
  const cat_disp1 = resource.category?.[0]?.coding?.[1]?.display ?? "";
  const cat_text = resource.category?.[0]?.text ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const onsetPeriod_start = resource.onsetPeriod?.start ?? "";
  const onsetPeriod_end = resource.onsetPeriod?.end ?? "";
  const recorderRef = resource.recordedDate ?? "";

  const cliStat_code0_s = firstSibling?.clinicalStatus?.coding?.[0]?.code ?? "";
  const cliStat_disp0_s = firstSibling?.clinicalStatus?.coding?.[0]?.display ?? "";
  const cliStat_code1_s = firstSibling?.clinicalStatus?.coding?.[1]?.code ?? "";
  const cliStat_disp1_s = firstSibling?.clinicalStatus?.coding?.[1]?.display ?? "";
  const cliStat_text_s = firstSibling?.clinicalStatus?.text ?? "";
  const cat_code0_s = firstSibling?.category?.[0]?.coding?.[0]?.code ?? "";
  const cat_disp0_s = firstSibling?.category?.[0]?.coding?.[0]?.display ?? "";
  const cat_code1_s = firstSibling?.category?.[0]?.coding?.[1]?.code ?? "";
  const cat_disp1_s = firstSibling?.category?.[0]?.coding?.[1]?.display ?? "";
  const cat_text_s = firstSibling?.category?.[0]?.text ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const onsetPeriod_start_s = firstSibling?.onsetPeriod?.start ?? "";
  const onsetPeriod_end_s = firstSibling?.onsetPeriod?.end ?? "";
  const recorderRef_s = firstSibling?.recordedDate ?? "";

  const code = getCode(resource, firstSibling);
  const bodySite = getBodySite(
    { bodySite: resource.bodySite?.[0] },
    { bodySite: firstSibling?.bodySite?.[0] }
  );

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    cliStat_code0,
    cliStat_code0_s,
    cliStat_disp0,
    cliStat_disp0_s,
    cliStat_code1,
    cliStat_code1_s,
    cliStat_disp1,
    cliStat_disp1_s,
    cliStat_text,
    cliStat_text_s,
    cat_code0,
    cat_code0_s,
    cat_disp0,
    cat_disp0_s,
    cat_code1,
    cat_code1_s,
    cat_disp1,
    cat_disp1_s,
    cat_text,
    cat_text_s,
    ...code,
    ...bodySite,
    subjRef,
    subjRef_s,
    encounterRef,
    encounterRef_s,
    onsetPeriod_start,
    onsetPeriod_start_s,
    onsetPeriod_end,
    onsetPeriod_end_s,
    recorderRef,
    recorderRef_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
