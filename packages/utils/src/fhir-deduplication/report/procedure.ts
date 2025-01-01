import { Procedure, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import {
  bodySiteColumns,
  codeColumns,
  getBodySite,
  getCode,
  getNotes,
  notesColumns,
} from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/procedure.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "subjRef",
  "subjRef_s",
  "encounterRef",
  "encounterRef_s",
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
  "perfdDateTime",
  "perfdDateTime_s",
  "perfdPeriod_start",
  "perfdPeriod_start_s",
  "perfdPeriod_end",
  "perfdPeriod_end_s",
  ...codeColumns,
  "recorderRef",
  "recorderRef_s",
  "perf0Ref",
  "perf0Ref_s",
  "perf0_funct",
  "perf0_funct_s",
  "perf0_obo",
  "perf0_obo_s",
  "perf1Ref",
  "perf1Ref_s",
  "perf1_funct",
  "perf1_funct_s",
  "perf1_obo",
  "perf1_obo_s",
  "locRef",
  "locRef_s",
  "reason0_code0",
  "reason0_code0_s",
  "reason0_disp0",
  "reason0_disp0_s",
  "reason0_code1",
  "reason0_code1_s",
  "reason0_disp1",
  "reason0_disp1_s",
  "reason0_text",
  "reason0_text_s",
  "reason1_code0",
  "reason1_code0_s",
  "reason1_disp0",
  "reason1_disp0_s",
  "reason1_code1",
  "reason1_code1_s",
  "reason1_disp1",
  "reason1_disp1_s",
  "reason1_text",
  "reason1_text_s",
  "reasonRef0",
  "reasonRef0_s",
  "reasonRef1",
  "reasonRef1_s",
  ...bodySiteColumns,
  ...notesColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processProcedure(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Procedure[] = (originalDic.Procedure ?? []).flatMap(r => (r as Procedure) ?? []);
  const dedup: Procedure[] = (dedupDic.Procedure ?? []).flatMap(r => (r as Procedure) ?? []);

  const originalFileName = patientDirName + `/Procedure-original.csv`;
  const dedupFileName = patientDirName + `/Procedure-dedup.csv`;

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

function sort(a: Procedure, b: Procedure): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Procedure, others: Procedure[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const cat_code0 = resource.category?.coding?.[0]?.code ?? "";
  const cat_disp0 = resource.category?.coding?.[0]?.display ?? "";
  const cat_code1 = resource.category?.coding?.[1]?.code ?? "";
  const cat_disp1 = resource.category?.coding?.[1]?.display ?? "";
  const cat_text = resource.category?.text ?? "";
  const perfdDateTime = resource.performedDateTime ?? "";
  const perfdPeriod_start = resource.performedPeriod?.start ?? "";
  const perfdPeriod_end = resource.performedPeriod?.end ?? "";
  const recorderRef = resource.recorder?.reference ?? "";
  const perf0Ref = resource.performer?.[0]?.actor?.reference ?? "";
  const perf0_funct = resource.performer?.[0]?.function?.coding?.[0]?.code ?? "";
  const perf0_obo = resource.performer?.[0]?.onBehalfOf?.reference ?? "";
  const perf1Ref = resource.performer?.[1]?.actor?.reference ?? "";
  const perf1_funct = resource.performer?.[1]?.function?.coding?.[0]?.code ?? "";
  const perf1_obo = resource.performer?.[1]?.onBehalfOf?.reference ?? "";
  const locRef = resource.location?.reference ?? "";
  const reason0_code0 = resource.reasonCode?.[0]?.coding?.[0]?.code ?? "";
  const reason0_disp0 = resource.reasonCode?.[0]?.coding?.[0]?.display ?? "";
  const reason0_code1 = resource.reasonCode?.[0]?.coding?.[1]?.code ?? "";
  const reason0_disp1 = resource.reasonCode?.[0]?.coding?.[1]?.display ?? "";
  const reason0_text = resource.reasonCode?.[0]?.text ?? "";
  const reason1_code0 = resource.reasonCode?.[1]?.coding?.[0]?.code ?? "";
  const reason1_disp0 = resource.reasonCode?.[1]?.coding?.[0]?.display ?? "";
  const reason1_code1 = resource.reasonCode?.[1]?.coding?.[1]?.code ?? "";
  const reason1_disp1 = resource.reasonCode?.[1]?.coding?.[1]?.display ?? "";
  const reason1_text = resource.reasonCode?.[1]?.text ?? "";
  const reasonRef0 = resource.reasonReference?.[0]?.reference ?? "";
  const reasonRef1 = resource.reasonReference?.[1]?.reference ?? "";

  const status_s = firstSibling?.status ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const cat_code0_s = firstSibling?.category?.coding?.[0]?.code ?? "";
  const cat_disp0_s = firstSibling?.category?.coding?.[0]?.display ?? "";
  const cat_code1_s = firstSibling?.category?.coding?.[1]?.code ?? "";
  const cat_disp1_s = firstSibling?.category?.coding?.[1]?.display ?? "";
  const cat_text_s = firstSibling?.category?.text ?? "";
  const perfdDateTime_s = firstSibling?.performedDateTime ?? "";
  const perfdPeriod_start_s = firstSibling?.performedPeriod?.start ?? "";
  const perfdPeriod_end_s = firstSibling?.performedPeriod?.end ?? "";
  const recorderRef_s = firstSibling?.recorder?.reference ?? "";
  const perf0Ref_s = firstSibling?.performer?.[0]?.actor?.reference ?? "";
  const perf0_funct_s = firstSibling?.performer?.[0]?.function?.coding?.[0]?.code ?? "";
  const perf0_obo_s = firstSibling?.performer?.[0]?.onBehalfOf?.reference ?? "";
  const perf1Ref_s = firstSibling?.performer?.[1]?.actor?.reference ?? "";
  const perf1_funct_s = firstSibling?.performer?.[1]?.function?.coding?.[0]?.code ?? "";
  const perf1_obo_s = firstSibling?.performer?.[1]?.onBehalfOf?.reference ?? "";
  const locRef_s = firstSibling?.location?.reference ?? "";
  const reason0_code0_s = firstSibling?.reasonCode?.[0]?.coding?.[0]?.code ?? "";
  const reason0_disp0_s = firstSibling?.reasonCode?.[0]?.coding?.[0]?.display ?? "";
  const reason0_code1_s = firstSibling?.reasonCode?.[0]?.coding?.[1]?.code ?? "";
  const reason0_disp1_s = firstSibling?.reasonCode?.[0]?.coding?.[1]?.display ?? "";
  const reason0_text_s = firstSibling?.reasonCode?.[0]?.text ?? "";
  const reason1_code0_s = firstSibling?.reasonCode?.[1]?.coding?.[0]?.code ?? "";
  const reason1_disp0_s = firstSibling?.reasonCode?.[1]?.coding?.[0]?.display ?? "";
  const reason1_code1_s = firstSibling?.reasonCode?.[1]?.coding?.[1]?.code ?? "";
  const reason1_disp1_s = firstSibling?.reasonCode?.[1]?.coding?.[1]?.display ?? "";
  const reason1_text_s = firstSibling?.reasonCode?.[1]?.text ?? "";
  const reasonRef0_s = firstSibling?.reasonReference?.[0]?.reference ?? "";
  const reasonRef1_s = firstSibling?.reasonReference?.[1]?.reference ?? "";

  const code = getCode(resource, firstSibling);
  const notes = getNotes(resource, firstSibling);
  const bodySite = getBodySite(
    { bodySite: resource.bodySite?.[0] },
    { bodySite: firstSibling?.bodySite?.[0] }
  );

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    subjRef,
    subjRef_s,
    encounterRef,
    encounterRef_s,
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
    perfdDateTime,
    perfdDateTime_s,
    perfdPeriod_start,
    perfdPeriod_start_s,
    perfdPeriod_end,
    perfdPeriod_end_s,
    ...code,
    recorderRef,
    recorderRef_s,
    perf0Ref,
    perf0Ref_s,
    perf0_funct,
    perf0_funct_s,
    perf0_obo,
    perf0_obo_s,
    perf1Ref,
    perf1Ref_s,
    perf1_funct,
    perf1_funct_s,
    perf1_obo,
    perf1_obo_s,
    locRef,
    locRef_s,
    reason0_code0,
    reason0_code0_s,
    reason0_disp0,
    reason0_disp0_s,
    reason0_code1,
    reason0_code1_s,
    reason0_disp1,
    reason0_disp1_s,
    reason0_text,
    reason0_text_s,
    reason1_code0,
    reason1_code0_s,
    reason1_disp0,
    reason1_disp0_s,
    reason1_code1,
    reason1_code1_s,
    reason1_disp1,
    reason1_disp1_s,
    reason1_text,
    reason1_text_s,
    reasonRef0,
    reasonRef0_s,
    reasonRef1,
    reasonRef1_s,
    ...bodySite,
    ...notes,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
