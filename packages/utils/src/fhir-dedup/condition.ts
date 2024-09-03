import { Condition, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, safeCsv } from "./csv";
import { bodySiteColumns, codeColumns, getBodySite, getCode } from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/condition.html if you want to add them
const columns = [
  "id_o",
  "date",
  "cliStat_code0_o",
  "cliStat_code0_d",
  "cliStat_display0_o",
  "cliStat_display0_d",
  "cliStat_code1_o",
  "cliStat_code1_d",
  "cliStat_display1_o",
  "cliStat_display1_d",
  "cliStat_text_o",
  "cliStat_text_d",
  "cat_code0_o",
  "cat_code0_d",
  "cat_disp0_o",
  "cat_disp0_d",
  "cat_code1_o",
  "cat_code1_d",
  "cat_disp1_o",
  "cat_disp1_d",
  "cat_text_o",
  "cat_text_d",
  ...codeColumns,
  ...bodySiteColumns,
  "subjRef_o",
  "subjRef_d",
  "encounterRef_o",
  "encounterRef_d",
  "onsetPeriod_start_o",
  "onsetPeriod_start_d",
  "onsetPeriod_end_o",
  "onsetPeriod_end_d",
  "recorderRef_o",
  "recorderRef_d",
  "id_d",
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

function toCsv(resource: Condition, siblings: Condition[]): string {
  const sibling = siblings.find(isSibling(resource));
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";

  // set all fields necessary to populate the "res" object below, using resource and sibling, using the processMedicationStatement function as reference. Start with the properties that need "resource", then populate the ones that rely on "sibling".
  const cliStat_code0_o = resource.clinicalStatus?.coding?.[0]?.code ?? "";
  const cliStat_display0_o = resource.clinicalStatus?.coding?.[0]?.display ?? "";
  const cliStat_code1_o = resource.clinicalStatus?.coding?.[1]?.code ?? "";
  const cliStat_display1_o = resource.clinicalStatus?.coding?.[1]?.display ?? "";
  const cliStat_text_o = resource.clinicalStatus?.text ?? "";
  const cat_code0_o = resource.category?.[0]?.coding?.[0]?.code ?? "";
  const cat_disp0_o = resource.category?.[0]?.coding?.[0]?.display ?? "";
  const cat_code1_o = resource.category?.[1]?.coding?.[0]?.code ?? "";
  const cat_disp1_o = resource.category?.[1]?.coding?.[0]?.display ?? "";
  const cat_text_o = resource.category?.[0]?.text ?? "";
  const subjRef_o = resource.subject?.reference ?? "";
  const encounterRef_o = resource.encounter?.reference ?? "";
  const onsetPeriod_start_o = resource.onsetPeriod?.start ?? "";
  const onsetPeriod_end_o = resource.onsetPeriod?.end ?? "";
  const recorderRef_o = resource.recordedDate ?? "";

  const cliStat_code0_d = sibling?.clinicalStatus?.coding?.[0]?.code ?? "";
  const cliStat_display0_d = sibling?.clinicalStatus?.coding?.[0]?.display ?? "";
  const cliStat_code1_d = sibling?.clinicalStatus?.coding?.[1]?.code ?? "";
  const cliStat_display1_d = sibling?.clinicalStatus?.coding?.[1]?.display ?? "";
  const cliStat_text_d = sibling?.clinicalStatus?.text ?? "";
  const cat_code0_d = sibling?.category?.[0]?.coding?.[0]?.code ?? "";
  const cat_code1_d = sibling?.category?.[1]?.coding?.[0]?.code ?? "";
  const cat_disp0_d = sibling?.category?.[0]?.coding?.[0]?.display ?? "";
  const cat_disp1_d = sibling?.category?.[1]?.coding?.[0]?.display ?? "";
  const cat_text_d = sibling?.category?.[0]?.text ?? "";
  const subjRef_d = sibling?.subject?.reference ?? "";
  const encounterRef_d = sibling?.encounter?.reference ?? "";
  const onsetPeriod_start_d = sibling?.onsetPeriod?.start ?? "";
  const onsetPeriod_end_d = sibling?.onsetPeriod?.end ?? "";
  const recorderRef_d = sibling?.recordedDate ?? "";

  const code = getCode(resource, sibling);
  const bodySite = getBodySite(
    { bodySite: resource.bodySite?.[0] },
    { bodySite: sibling?.bodySite?.[0] }
  );

  const res: Record<Columns, string | number | boolean> = {
    id_o: resource.id ?? "",
    date,
    cliStat_code0_o,
    cliStat_code0_d,
    cliStat_display0_o,
    cliStat_display0_d,
    cliStat_code1_o,
    cliStat_code1_d,
    cliStat_display1_o,
    cliStat_display1_d,
    cliStat_text_o,
    cliStat_text_d,
    cat_code0_o,
    cat_code0_d,
    cat_disp0_o,
    cat_disp0_d,
    cat_code1_o,
    cat_code1_d,
    cat_disp1_o,
    cat_disp1_d,
    cat_text_o,
    cat_text_d,
    ...code,
    ...bodySite,
    subjRef_o,
    subjRef_d,
    encounterRef_o,
    encounterRef_d,
    onsetPeriod_start_o,
    onsetPeriod_start_d,
    onsetPeriod_end_o,
    onsetPeriod_end_d,
    recorderRef_o,
    recorderRef_d,
    id_d: sibling?.id ?? "",
  };
  return Object.values(res).map(safeCsv).join(csvSeparator);
}
