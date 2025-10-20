import { FamilyMemberHistory, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { getNotes, notesColumns } from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/familymemberhistory.html if you want to add them
const columns = [
  "id",
  "updatedAt",
  "links",
  "status",
  "status_s",
  "date",
  "date_s",
  "patientRef",
  "patientRef_s",
  "name",
  "name_s",
  "sex_code0",
  "sex_code0_s",
  "sex_disp0",
  "sex_disp0_s",
  "sex_code1",
  "sex_code1_s",
  "sex_disp1",
  "sex_disp1_s",
  "sex_text",
  "sex_text_s",
  "relat_code0",
  "relat_code0_s",
  "relat_disp0",
  "relat_disp0_s",
  "relat_code1",
  "relat_code1_s",
  "relat_disp1",
  "relat_disp1_s",
  "relat_text",
  "relat_text_s",
  "cond0_code_code0",
  "cond0_code_code0_s",
  "cond0_code_disp0",
  "cond0_code_disp0_s",
  "cond0_code_text",
  "cond0_code_text_s",
  "cond0_outcome_code0",
  "cond0_outcome_code0_s",
  "cond0_outcome_disp0",
  "cond0_outcome_disp0_s",
  "cond0_outcome_text",
  "cond0_outcome_text_s",
  "cond0_contribdToDeath",
  "cond0_contribdToDeath_s",
  "cond0_onsetPeriod_start",
  "cond0_onsetPeriod_start_s",
  "cond0_onsetPeriod_end",
  "cond0_onsetPeriod_end_s",
  "cond1_code_code0",
  "cond1_code_code0_s",
  "cond1_code_disp0",
  "cond1_code_disp0_s",
  "cond1_code_text",
  "cond1_code_text_s",
  "cond1_outcome_code0",
  "cond1_outcome_code0_s",
  "cond1_outcome_disp0",
  "cond1_outcome_disp0_s",
  "cond1_outcome_text",
  "cond1_outcome_text_s",
  "cond1_contribdToDeath",
  "cond1_contribdToDeath_s",
  "cond1_onsetPeriod_start",
  "cond1_onsetPeriod_start_s",
  "cond1_onsetPeriod_end",
  "cond1_onsetPeriod_end_s",
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
  "reasonRef0",
  "reasonRef0_s",
  "reasonRef1",
  "reasonRef1_s",
  ...notesColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processFamilyMemberHistory(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: FamilyMemberHistory[] = (originalDic.FamilyMemberHistory ?? []).flatMap(
    r => (r as FamilyMemberHistory) ?? []
  );
  const dedup: FamilyMemberHistory[] = (dedupDic.FamilyMemberHistory ?? []).flatMap(
    r => (r as FamilyMemberHistory) ?? []
  );

  const originalFileName = patientDirName + `/FamilyMemberHistory-original.csv`;
  const dedupFileName = patientDirName + `/FamilyMemberHistory-dedup.csv`;

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

function sort(a: FamilyMemberHistory, b: FamilyMemberHistory): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: FamilyMemberHistory, others: FamilyMemberHistory[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const date = resource.date ? new Date(resource.date).toISOString() : "";
  const patientRef = resource.patient?.reference ?? "";
  const name = resource.name ?? "";
  const sex_code0 = resource.sex?.coding?.[0]?.code ?? "";
  const sex_disp0 = resource.sex?.coding?.[0]?.display ?? "";
  const sex_code1 = resource.sex?.coding?.[1]?.code ?? "";
  const sex_disp1 = resource.sex?.coding?.[1]?.display ?? "";
  const sex_text = resource.sex?.text ?? "";
  const relat_code0 = resource.relationship?.coding?.[0]?.code ?? "";
  const relat_disp0 = resource.relationship?.coding?.[0]?.display ?? "";
  const relat_code1 = resource.relationship?.coding?.[1]?.code ?? "";
  const relat_disp1 = resource.relationship?.coding?.[1]?.display ?? "";
  const relat_text = resource.relationship?.text ?? "";
  const cond0_code_code0 = resource.condition?.[0]?.code?.coding?.[0]?.code ?? "";
  const cond0_code_disp0 = resource.condition?.[0]?.code?.coding?.[0]?.display ?? "";
  const cond0_code_text = resource.condition?.[0]?.code?.text ?? "";
  const cond0_outcome_code0 = resource.condition?.[0]?.outcome?.coding?.[0]?.code ?? "";
  const cond0_outcome_disp0 = resource.condition?.[0]?.outcome?.coding?.[0]?.display ?? "";
  const cond0_outcome_text = resource.condition?.[0]?.outcome?.text ?? "";
  const cond0_contribdToDeath = resource.condition?.[0]?.contributedToDeath ?? "";
  const cond0_onsetPeriod_start = resource.condition?.[0]?.onsetPeriod?.start ?? "";
  const cond0_onsetPeriod_end = resource.condition?.[0]?.onsetPeriod?.end ?? "";
  const cond1_code_code0 = resource.condition?.[1]?.code?.coding?.[0]?.code ?? "";
  const cond1_code_disp0 = resource.condition?.[1]?.code?.coding?.[0]?.display ?? "";
  const cond1_code_text = resource.condition?.[1]?.code?.text ?? "";
  const cond1_outcome_code0 = resource.condition?.[1]?.outcome?.coding?.[0]?.code ?? "";
  const cond1_outcome_disp0 = resource.condition?.[1]?.outcome?.coding?.[0]?.display ?? "";
  const cond1_outcome_text = resource.condition?.[1]?.outcome?.text ?? "";
  const cond1_contribdToDeath = resource.condition?.[1]?.contributedToDeath ?? "";
  const cond1_onsetPeriod_start = resource.condition?.[1]?.onsetPeriod?.start ?? "";
  const cond1_onsetPeriod_end = resource.condition?.[1]?.onsetPeriod?.end ?? "";
  const reason0_code0 = resource.reasonCode?.[0]?.coding?.[0]?.code ?? "";
  const reason0_disp0 = resource.reasonCode?.[0]?.coding?.[0]?.display ?? "";
  const reason0_code1 = resource.reasonCode?.[0]?.coding?.[1]?.code ?? "";
  const reason0_disp1 = resource.reasonCode?.[0]?.coding?.[1]?.display ?? "";
  const reason0_text = resource.reasonCode?.[0]?.text ?? "";
  const reasonRef0 = resource.reasonReference?.[0]?.reference ?? "";
  const reasonRef1 = resource.reasonReference?.[1]?.reference ?? "";

  const status_s = firstSibling?.status ?? "";
  const date_s = firstSibling?.date ? new Date(firstSibling.date).toISOString() : "";
  const patientRef_s = firstSibling?.patient?.reference ?? "";
  const name_s = firstSibling?.name ?? "";
  const sex_code0_s = firstSibling?.sex?.coding?.[0]?.code ?? "";
  const sex_disp0_s = firstSibling?.sex?.coding?.[0]?.display ?? "";
  const sex_code1_s = firstSibling?.sex?.coding?.[1]?.code ?? "";
  const sex_disp1_s = firstSibling?.sex?.coding?.[1]?.display ?? "";
  const sex_text_s = firstSibling?.sex?.text ?? "";
  const relat_code0_s = firstSibling?.relationship?.coding?.[0]?.code ?? "";
  const relat_disp0_s = firstSibling?.relationship?.coding?.[0]?.display ?? "";
  const relat_code1_s = firstSibling?.relationship?.coding?.[1]?.code ?? "";
  const relat_disp1_s = firstSibling?.relationship?.coding?.[1]?.display ?? "";
  const relat_text_s = firstSibling?.relationship?.text ?? "";
  const cond0_code_code0_s = firstSibling?.condition?.[0]?.code?.coding?.[0]?.code ?? "";
  const cond0_code_disp0_s = firstSibling?.condition?.[0]?.code?.coding?.[0]?.display ?? "";
  const cond0_code_text_s = firstSibling?.condition?.[0]?.code?.text ?? "";
  const cond0_outcome_code0_s = firstSibling?.condition?.[0]?.outcome?.coding?.[0]?.code ?? "";
  const cond0_outcome_disp0_s = firstSibling?.condition?.[0]?.outcome?.coding?.[0]?.display ?? "";
  const cond0_outcome_text_s = firstSibling?.condition?.[0]?.outcome?.text ?? "";
  const cond0_contribdToDeath_s = firstSibling?.condition?.[0]?.contributedToDeath ?? "";
  const cond0_onsetPeriod_start_s = firstSibling?.condition?.[0]?.onsetPeriod?.start ?? "";
  const cond0_onsetPeriod_end_s = firstSibling?.condition?.[0]?.onsetPeriod?.end ?? "";
  const cond1_code_code0_s = firstSibling?.condition?.[1]?.code?.coding?.[0]?.code ?? "";
  const cond1_code_disp0_s = firstSibling?.condition?.[1]?.code?.coding?.[0]?.display ?? "";
  const cond1_code_text_s = firstSibling?.condition?.[1]?.code?.text ?? "";
  const cond1_outcome_code0_s = firstSibling?.condition?.[1]?.outcome?.coding?.[0]?.code ?? "";
  const cond1_outcome_disp0_s = firstSibling?.condition?.[1]?.outcome?.coding?.[0]?.display ?? "";
  const cond1_outcome_text_s = firstSibling?.condition?.[1]?.outcome?.text ?? "";
  const cond1_contribdToDeath_s = firstSibling?.condition?.[1]?.contributedToDeath ?? "";
  const cond1_onsetPeriod_start_s = firstSibling?.condition?.[1]?.onsetPeriod?.start ?? "";
  const cond1_onsetPeriod_end_s = firstSibling?.condition?.[1]?.onsetPeriod?.end ?? "";
  const reason0_code0_s = firstSibling?.reasonCode?.[0]?.coding?.[0]?.code ?? "";
  const reason0_disp0_s = firstSibling?.reasonCode?.[0]?.coding?.[0]?.display ?? "";
  const reason0_code1_s = firstSibling?.reasonCode?.[0]?.coding?.[1]?.code ?? "";
  const reason0_disp1_s = firstSibling?.reasonCode?.[0]?.coding?.[1]?.display ?? "";
  const reason0_text_s = firstSibling?.reasonCode?.[0]?.text ?? "";
  const reasonRef0_s = firstSibling?.reasonReference?.[0]?.reference ?? "";
  const reasonRef1_s = firstSibling?.reasonReference?.[1]?.reference ?? "";

  const notes = getNotes(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    status,
    status_s,
    date,
    date_s,
    patientRef,
    patientRef_s,
    name,
    name_s,
    sex_code0,
    sex_code0_s,
    sex_disp0,
    sex_disp0_s,
    sex_code1,
    sex_code1_s,
    sex_disp1,
    sex_disp1_s,
    sex_text,
    sex_text_s,
    relat_code0,
    relat_code0_s,
    relat_disp0,
    relat_disp0_s,
    relat_code1,
    relat_code1_s,
    relat_disp1,
    relat_disp1_s,
    relat_text,
    relat_text_s,
    cond0_code_code0,
    cond0_code_code0_s,
    cond0_code_disp0,
    cond0_code_disp0_s,
    cond0_code_text,
    cond0_code_text_s,
    cond0_outcome_code0,
    cond0_outcome_code0_s,
    cond0_outcome_disp0,
    cond0_outcome_disp0_s,
    cond0_outcome_text,
    cond0_outcome_text_s,
    cond0_contribdToDeath,
    cond0_contribdToDeath_s,
    cond0_onsetPeriod_start,
    cond0_onsetPeriod_start_s,
    cond0_onsetPeriod_end,
    cond0_onsetPeriod_end_s,
    cond1_code_code0,
    cond1_code_code0_s,
    cond1_code_disp0,
    cond1_code_disp0_s,
    cond1_code_text,
    cond1_code_text_s,
    cond1_outcome_code0,
    cond1_outcome_code0_s,
    cond1_outcome_disp0,
    cond1_outcome_disp0_s,
    cond1_outcome_text,
    cond1_outcome_text_s,
    cond1_contribdToDeath,
    cond1_contribdToDeath_s,
    cond1_onsetPeriod_start,
    cond1_onsetPeriod_start_s,
    cond1_onsetPeriod_end,
    cond1_onsetPeriod_end_s,
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
    reasonRef0,
    reasonRef0_s,
    reasonRef1,
    reasonRef1_s,
    ...notes,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
