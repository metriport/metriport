import { Encounter, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import {
  getReasonCode,
  getReasonReference,
  reasonCodeColumns,
  reasonReferenceColumns,
} from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/encounter.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "class_code",
  "class_code_s",
  "class_display",
  "class_display_s",
  "type0_code0",
  "type0_code0_s",
  "type0_disp0",
  "type0_disp0_s",
  "type0_code1",
  "type0_code1_s",
  "type0_disp1",
  "type0_disp1_s",
  "type0_text",
  "type0_text_s",
  "type1_code0",
  "type1_code0_s",
  "type1_disp0",
  "type1_disp0_s",
  "type1_code1",
  "type1_code1_s",
  "type1_disp1",
  "type1_disp1_s",
  "type1_text",
  "type1_text_s",
  "subjRef",
  "subjRef_s",
  "partcpt0_indivRef",
  "partcpt0_indivRef_s",
  "partcpt0_type0_code0",
  "partcpt0_type0_code0_s",
  "partcpt0_type0_disp0",
  "partcpt0_type0_disp0_s",
  "partcpt0_type0_text",
  "partcpt0_type0_text_s",
  "partcpt0_period_strt",
  "partcpt0_period_strt_s",
  "partcpt0_period_end",
  "partcpt0_period_end_s",
  "partcpt1_indivRef",
  "partcpt1_indivRef_s",
  "partcpt1_type0_code0",
  "partcpt1_type0_code0_s",
  "partcpt1_type0_disp0",
  "partcpt1_type0_disp0_s",
  "partcpt1_type0_text",
  "partcpt1_type0_text_s",
  "partcpt1_period_strt",
  "partcpt1_period_strt_s",
  "partcpt1_period_end",
  "partcpt1_period_end_s",
  "period_strt",
  "period_strt_s",
  "period_end",
  "period_end_s",
  ...reasonCodeColumns,
  ...reasonReferenceColumns,
  "diagCount",
  "diagCount_s",
  "diag0_conditionRef",
  "diag0_conditionRef_s",
  "diag1_conditionRef",
  "diag1_conditionRef_s",
  "diag2_conditionRef",
  "diag2_conditionRef_s",
  "diag3_conditionRef",
  "diag3_conditionRef_s",
  "diag4_conditionRef",
  "diag4_conditionRef_s",
  "hosp_code0",
  "hosp_code0_s",
  "hosp_disp0",
  "hosp_disp0_s",
  "hosp_code1",
  "hosp_code1_s",
  "hosp_disp1",
  "hosp_disp1_s",
  "hosp_text",
  "hosp_text_s",
  "loc0_locRef",
  "loc0_locRef_s",
  "loc1_locRef",
  "loc1_locRef_s",
  "srvcProvRef",
  "srvcProvRef_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processEncounter(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Encounter[] = (originalDic.Encounter ?? []).flatMap(r => (r as Encounter) ?? []);
  const dedup: Encounter[] = (dedupDic.Encounter ?? []).flatMap(r => (r as Encounter) ?? []);

  const originalFileName = patientDirName + `/Encounter-original.csv`;
  const dedupFileName = patientDirName + `/Encounter-dedup.csv`;

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

function sort(a: Encounter, b: Encounter): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Encounter, others: Encounter[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const class_code = resource.class?.code ?? "";
  const class_display = resource.class?.display ?? "";
  const type0 = resource.type?.[0];
  const type0_code0 = type0?.coding?.[0]?.code ?? "";
  const type0_disp0 = type0?.coding?.[0]?.display ?? "";
  const type0_code1 = type0?.coding?.[1]?.code ?? "";
  const type0_disp1 = type0?.coding?.[1]?.display ?? "";
  const type0_text = type0?.text ?? "";
  const type1 = resource.type?.[1];
  const type1_code0 = type1?.coding?.[0]?.code ?? "";
  const type1_disp0 = type1?.coding?.[0]?.display ?? "";
  const type1_code1 = type1?.coding?.[1]?.code ?? "";
  const type1_disp1 = type1?.coding?.[1]?.display ?? "";
  const type1_text = type1?.text ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const partcpt0_indivRef = resource.participant?.[0]?.individual?.reference ?? "";
  const partcpt0_type0_code0 = resource.participant?.[0]?.type?.[0]?.coding?.[0]?.code ?? "";
  const partcpt0_type0_disp0 = resource.participant?.[0]?.type?.[0]?.coding?.[0]?.display ?? "";
  const partcpt0_type0_text = resource.participant?.[0]?.type?.[0]?.text ?? "";
  const partcpt0_period_strt = resource.participant?.[0]?.period?.start ?? "";
  const partcpt0_period_end = resource.participant?.[0]?.period?.end ?? "";
  const partcpt1_indivRef = resource.participant?.[1]?.individual?.reference ?? "";
  const partcpt1_type0_code0 = resource.participant?.[1]?.type?.[0]?.coding?.[0]?.code ?? "";
  const partcpt1_type0_disp0 = resource.participant?.[1]?.type?.[0]?.coding?.[0]?.display ?? "";
  const partcpt1_type0_text = resource.participant?.[1]?.type?.[0]?.text ?? "";
  const partcpt1_period_strt = resource.participant?.[1]?.period?.start ?? "";
  const partcpt1_period_end = resource.participant?.[1]?.period?.end ?? "";
  const period_strt = resource.period?.start ?? "";
  const period_end = resource.period?.end ?? "";
  const diagCount = resource.diagnosis?.length ?? "";
  const diag0_conditionRef = resource.diagnosis?.[0]?.condition?.reference ?? "";
  const diag1_conditionRef = resource.diagnosis?.[1]?.condition?.reference ?? "";
  const diag2_conditionRef = resource.diagnosis?.[2]?.condition?.reference ?? "";
  const diag3_conditionRef = resource.diagnosis?.[3]?.condition?.reference ?? "";
  const diag4_conditionRef = resource.diagnosis?.[4]?.condition?.reference ?? "";
  const hosp_code0 = resource.hospitalization?.dischargeDisposition?.coding?.[0]?.code ?? "";
  const hosp_disp0 = resource.hospitalization?.dischargeDisposition?.coding?.[0]?.display ?? "";
  const hosp_code1 = resource.hospitalization?.dischargeDisposition?.coding?.[1]?.code ?? "";
  const hosp_disp1 = resource.hospitalization?.dischargeDisposition?.coding?.[1]?.display ?? "";
  const hosp_text = resource.hospitalization?.dischargeDisposition?.text ?? "";
  const loc0_locRef = resource.location?.[0]?.location?.reference ?? "";
  const loc1_locRef = resource.location?.[1]?.location?.reference ?? "";
  const srvcProvRef = resource.serviceProvider?.reference ?? "";

  const status_s = firstSibling?.status ?? "";
  const class_code_s = firstSibling?.class?.code ?? "";
  const class_display_s = firstSibling?.class?.display ?? "";
  const type0_s = firstSibling?.type?.[0];
  const type0_code0_s = type0_s?.coding?.[0]?.code ?? "";
  const type0_disp0_s = type0_s?.coding?.[0]?.display ?? "";
  const type0_code1_s = type0_s?.coding?.[1]?.code ?? "";
  const type0_disp1_s = type0_s?.coding?.[1]?.display ?? "";
  const type0_text_s = type0_s?.text ?? "";
  const type1_s = firstSibling?.type?.[1];
  const type1_code0_s = type1_s?.coding?.[0]?.code ?? "";
  const type1_disp0_s = type1_s?.coding?.[0]?.display ?? "";
  const type1_code1_s = type1_s?.coding?.[1]?.code ?? "";
  const type1_disp1_s = type1_s?.coding?.[1]?.display ?? "";
  const type1_text_s = type1_s?.text ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const partcpt0_indivRef_s = firstSibling?.participant?.[0]?.individual?.reference ?? "";
  const partcpt0_type0_code0_s = firstSibling?.participant?.[0]?.type?.[0]?.coding?.[0]?.code ?? "";
  const partcpt0_type0_disp0_s =
    firstSibling?.participant?.[0]?.type?.[0]?.coding?.[0]?.display ?? "";
  const partcpt0_type0_text_s = firstSibling?.participant?.[0]?.type?.[0]?.text ?? "";
  const partcpt0_period_strt_s = firstSibling?.participant?.[0]?.period?.start ?? "";
  const partcpt0_period_end_s = firstSibling?.participant?.[0]?.period?.end ?? "";
  const partcpt1_indivRef_s = firstSibling?.participant?.[1]?.individual?.reference ?? "";
  const partcpt1_type0_code0_s = firstSibling?.participant?.[1]?.type?.[0]?.coding?.[0]?.code ?? "";
  const partcpt1_type0_disp0_s =
    firstSibling?.participant?.[1]?.type?.[0]?.coding?.[0]?.display ?? "";
  const partcpt1_type0_text_s = firstSibling?.participant?.[1]?.type?.[0]?.text ?? "";
  const partcpt1_period_strt_s = firstSibling?.participant?.[1]?.period?.start ?? "";
  const partcpt1_period_end_s = firstSibling?.participant?.[1]?.period?.end ?? "";
  const period_strt_s = firstSibling?.period?.start ?? "";
  const period_end_s = firstSibling?.period?.end ?? "";
  const diagCount_s = firstSibling?.diagnosis?.length ?? "";
  const diag0_conditionRef_s = firstSibling?.diagnosis?.[0]?.condition?.reference ?? "";
  const diag1_conditionRef_s = firstSibling?.diagnosis?.[1]?.condition?.reference ?? "";
  const diag2_conditionRef_s = firstSibling?.diagnosis?.[2]?.condition?.reference ?? "";
  const diag3_conditionRef_s = firstSibling?.diagnosis?.[3]?.condition?.reference ?? "";
  const diag4_conditionRef_s = firstSibling?.diagnosis?.[4]?.condition?.reference ?? "";
  const hosp_code0_s = firstSibling?.hospitalization?.dischargeDisposition?.coding?.[0]?.code ?? "";
  const hosp_disp0_s =
    firstSibling?.hospitalization?.dischargeDisposition?.coding?.[0]?.display ?? "";
  const hosp_code1_s = firstSibling?.hospitalization?.dischargeDisposition?.coding?.[1]?.code ?? "";
  const hosp_disp1_s =
    firstSibling?.hospitalization?.dischargeDisposition?.coding?.[1]?.display ?? "";
  const hosp_text_s = firstSibling?.hospitalization?.dischargeDisposition?.text ?? "";
  const loc0_locRef_s = firstSibling?.location?.[0]?.location?.reference ?? "";
  const loc1_locRef_s = firstSibling?.location?.[1]?.location?.reference ?? "";
  const srvcProvRef_s = firstSibling?.serviceProvider?.reference ?? "";

  const reasonCodes = getReasonCode(resource, firstSibling);
  const reasonReferences = getReasonReference(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    class_code,
    class_code_s,
    class_display,
    class_display_s,
    type0_code0,
    type0_code0_s,
    type0_disp0,
    type0_disp0_s,
    type0_code1,
    type0_code1_s,
    type0_disp1,
    type0_disp1_s,
    type0_text,
    type0_text_s,
    type1_code0,
    type1_code0_s,
    type1_disp0,
    type1_disp0_s,
    type1_code1,
    type1_code1_s,
    type1_disp1,
    type1_disp1_s,
    type1_text,
    type1_text_s,
    subjRef,
    subjRef_s,
    partcpt0_indivRef,
    partcpt0_indivRef_s,
    partcpt0_type0_code0,
    partcpt0_type0_code0_s,
    partcpt0_type0_disp0,
    partcpt0_type0_disp0_s,
    partcpt0_type0_text,
    partcpt0_type0_text_s,
    partcpt0_period_strt,
    partcpt0_period_strt_s,
    partcpt0_period_end,
    partcpt0_period_end_s,
    partcpt1_indivRef,
    partcpt1_indivRef_s,
    partcpt1_type0_code0,
    partcpt1_type0_code0_s,
    partcpt1_type0_disp0,
    partcpt1_type0_disp0_s,
    partcpt1_type0_text,
    partcpt1_type0_text_s,
    partcpt1_period_strt,
    partcpt1_period_strt_s,
    partcpt1_period_end,
    partcpt1_period_end_s,
    period_strt,
    period_strt_s,
    period_end,
    period_end_s,
    ...reasonCodes,
    ...reasonReferences,
    diagCount,
    diagCount_s,
    diag0_conditionRef,
    diag0_conditionRef_s,
    diag1_conditionRef,
    diag1_conditionRef_s,
    diag2_conditionRef,
    diag2_conditionRef_s,
    diag3_conditionRef,
    diag3_conditionRef_s,
    diag4_conditionRef,
    diag4_conditionRef_s,
    hosp_code0,
    hosp_code0_s,
    hosp_disp0,
    hosp_disp0_s,
    hosp_code1,
    hosp_code1_s,
    hosp_disp1,
    hosp_disp1_s,
    hosp_text,
    hosp_text_s,
    loc0_locRef,
    loc0_locRef_s,
    loc1_locRef,
    loc1_locRef_s,
    srvcProvRef,
    srvcProvRef_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
