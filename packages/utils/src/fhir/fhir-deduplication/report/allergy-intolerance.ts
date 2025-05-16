import { AllergyIntolerance, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { codeColumns, getCode, getNotes, notesColumns } from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/allergyintolerance.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "clinicStatus",
  "clinicStatus_s",
  "react0_desc",
  "react0_desc_s",
  "react0_onset",
  "react0_onset_s",
  "react0_severity",
  "react0_severity_s",
  "react0_subs_code0",
  "react0_subs_code0_s",
  "react0_subs_disp0",
  "react0_subs_disp0_s",
  "react0_subs_code1",
  "react0_subs_code1_s",
  "react0_subs_disp1",
  "react0_subs_disp1_s",
  "react0_subs_text",
  "react0_subs_text_s",
  "react0_manif0_code0",
  "react0_manif0_code0_s",
  "react0_manif0_disp0",
  "react0_manif0_disp0_s",
  "react0_manif0_code1",
  "react0_manif0_code1_s",
  "react0_manif0_disp1",
  "react0_manif0_disp1_s",
  "react0_manif0_text",
  "react0_manif0_text_s",
  "react0_manif1_code0",
  "react0_manif1_code0_s",
  "react0_manif1_disp0",
  "react0_manif1_disp0_s",
  "react0_manif1_code1",
  "react0_manif1_code1_s",
  "react0_manif1_disp1",
  "react0_manif1_disp1_s",
  "react0_manif1_text",
  "react0_manif1_text_s",
  "react0_note0_txt",
  "react0_note0_txt_s",
  "react0_note1_txt",
  "react0_note1_txt_s",
  "react1_desc",
  "react1_desc_s",
  "react1_onset",
  "react1_onset_s",
  "react1_severity",
  "react1_severity_s",
  "react1_subs_code0",
  "react1_subs_code0_s",
  "react1_subs_disp0",
  "react1_subs_disp0_s",
  "react1_subs_code1",
  "react1_subs_code1_s",
  "react1_subs_disp1",
  "react1_subs_disp1_s",
  "react1_subs_text",
  "react1_subs_text_s",
  "react1_manif0_code0",
  "react1_manif0_code0_s",
  "react1_manif0_disp0",
  "react1_manif0_disp0_s",
  "react1_manif0_code1",
  "react1_manif0_code1_s",
  "react1_manif0_disp1",
  "react1_manif0_disp1_s",
  "react1_manif0_text",
  "react1_manif0_text_s",
  "react1_manif1_code0",
  "react1_manif1_code0_s",
  "react1_manif1_disp0",
  "react1_manif1_disp0_s",
  "react1_manif1_code1",
  "react1_manif1_code1_s",
  "react1_manif1_disp1",
  "react1_manif1_disp1_s",
  "react1_manif1_text",
  "react1_manif1_text_s",
  "react1_note0_txt",
  "react1_note0_txt_s",
  "react1_note1_txt",
  "react1_note1_txt_s",
  "type",
  "type_s",
  "cat0",
  "cat0_s",
  "cat1",
  "cat1_s",
  "criticlty",
  "criticlty_s",
  ...codeColumns,
  "patientRef",
  "patientRef_s",
  "encounterRef",
  "encounterRef_s",
  "onsetPeriod_start",
  "onsetPeriod_start_s",
  "onsetPeriod_end",
  "onsetPeriod_end_s",
  "recorderRef",
  "recorderRef_s",
  ...notesColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processAllergyIntolerance(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: AllergyIntolerance[] = (originalDic.AllergyIntolerance ?? []).flatMap(
    r => (r as AllergyIntolerance) ?? []
  );
  const dedup: AllergyIntolerance[] = (dedupDic.AllergyIntolerance ?? []).flatMap(
    r => (r as AllergyIntolerance) ?? []
  );

  const originalFileName = patientDirName + `/AllergyIntolerance-original.csv`;
  const dedupFileName = patientDirName + `/AllergyIntolerance-dedup.csv`;

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

function sort(a: AllergyIntolerance, b: AllergyIntolerance): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: AllergyIntolerance, others: AllergyIntolerance[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const clinicStatus = resource.clinicalStatus?.coding?.[0]?.code ?? "";
  const type = resource.type ?? "";
  const cat0 = resource?.category?.[0] ?? "";
  const cat1 = resource?.category?.[1] ?? "";
  const criticlty = resource.criticality ?? "";
  const patientRef = resource.patient?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const onsetPeriod_start = resource.onsetPeriod?.start ?? "";
  const onsetPeriod_end = resource.onsetPeriod?.end ?? "";
  const recorderRef = resource.recorder?.reference ?? "";
  const react0 = resource.reaction?.[0];
  const react0_desc = react0?.description ?? "";
  const react0_onset = react0?.onset ?? "";
  const react0_severity = react0?.severity ?? "";
  const react0_subs_code0 = react0?.substance?.coding?.[0]?.code ?? "";
  const react0_subs_disp0 = react0?.substance?.coding?.[0]?.display ?? "";
  const react0_subs_code1 = react0?.substance?.coding?.[1]?.code ?? "";
  const react0_subs_disp1 = react0?.substance?.coding?.[1]?.display ?? "";
  const react0_subs_text = react0?.substance?.text ?? "";
  const react0_manif0_code0 = react0?.manifestation?.[0]?.coding?.[0]?.code ?? "";
  const react0_manif0_disp0 = react0?.manifestation?.[0]?.coding?.[0]?.display ?? "";
  const react0_manif0_code1 = react0?.manifestation?.[0]?.coding?.[1]?.code ?? "";
  const react0_manif0_disp1 = react0?.manifestation?.[0]?.coding?.[1]?.display ?? "";
  const react0_manif0_text = react0?.manifestation?.[0]?.text ?? "";
  const react0_manif1_code0 = react0?.manifestation?.[1]?.coding?.[0]?.code ?? "";
  const react0_manif1_disp0 = react0?.manifestation?.[1]?.coding?.[0]?.display ?? "";
  const react0_manif1_code1 = react0?.manifestation?.[1]?.coding?.[1]?.code ?? "";
  const react0_manif1_disp1 = react0?.manifestation?.[1]?.coding?.[1]?.display ?? "";
  const react0_manif1_text = react0?.manifestation?.[1]?.text ?? "";
  const react0_note0_txt = react0?.note?.[0]?.text ?? "";
  const react0_note1_txt = react0?.note?.[1]?.text ?? "";
  const react1 = resource.reaction?.[1];
  const react1_desc = react1?.description ?? "";
  const react1_onset = react1?.onset ?? "";
  const react1_severity = react1?.severity ?? "";
  const react1_subs_code0 = react1?.substance?.coding?.[0]?.code ?? "";
  const react1_subs_disp0 = react1?.substance?.coding?.[0]?.display ?? "";
  const react1_subs_code1 = react1?.substance?.coding?.[1]?.code ?? "";
  const react1_subs_disp1 = react1?.substance?.coding?.[1]?.display ?? "";
  const react1_subs_text = react1?.substance?.text ?? "";
  const react1_manif0_code0 = react1?.manifestation?.[0]?.coding?.[0]?.code ?? "";
  const react1_manif0_disp0 = react1?.manifestation?.[0]?.coding?.[0]?.display ?? "";
  const react1_manif0_code1 = react1?.manifestation?.[0]?.coding?.[1]?.code ?? "";
  const react1_manif0_disp1 = react1?.manifestation?.[0]?.coding?.[1]?.display ?? "";
  const react1_manif0_text = react1?.manifestation?.[0]?.text ?? "";
  const react1_manif1_code0 = react1?.manifestation?.[1]?.coding?.[0]?.code ?? "";
  const react1_manif1_disp0 = react1?.manifestation?.[1]?.coding?.[0]?.display ?? "";
  const react1_manif1_code1 = react1?.manifestation?.[1]?.coding?.[1]?.code ?? "";
  const react1_manif1_disp1 = react1?.manifestation?.[1]?.coding?.[1]?.display ?? "";
  const react1_manif1_text = react1?.manifestation?.[1]?.text ?? "";
  const react1_note0_txt = react1?.note?.[0]?.text ?? "";
  const react1_note1_txt = react1?.note?.[1]?.text ?? "";

  const clinicStatus_s = firstSibling?.clinicalStatus?.coding?.[0]?.code ?? "";
  const type_s = firstSibling?.type ?? "";
  const cat0_s = firstSibling?.category?.[0] ?? "";
  const cat1_s = firstSibling?.category?.[1] ?? "";
  const criticlty_s = firstSibling?.criticality ?? "";
  const patientRef_s = firstSibling?.patient?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const onsetPeriod_start_s = firstSibling?.onsetPeriod?.start ?? "";
  const onsetPeriod_end_s = firstSibling?.onsetPeriod?.end ?? "";
  const recorderRef_s = firstSibling?.recorder?.reference ?? "";
  const react0_s = firstSibling?.reaction?.[0];
  const react0_desc_s = react0_s?.description ?? "";
  const react0_onset_s = react0_s?.onset ?? "";
  const react0_severity_s = react0_s?.severity ?? "";
  const react0_subs_code0_s = react0_s?.substance?.coding?.[0]?.code ?? "";
  const react0_subs_disp0_s = react0_s?.substance?.coding?.[0]?.display ?? "";
  const react0_subs_code1_s = react0_s?.substance?.coding?.[1]?.code ?? "";
  const react0_subs_disp1_s = react0_s?.substance?.coding?.[1]?.display ?? "";
  const react0_subs_text_s = react0_s?.substance?.text ?? "";
  const react0_manif0_code0_s = react0_s?.manifestation?.[0]?.coding?.[0]?.code ?? "";
  const react0_manif0_disp0_s = react0_s?.manifestation?.[0]?.coding?.[0]?.display ?? "";
  const react0_manif0_code1_s = react0_s?.manifestation?.[0]?.coding?.[1]?.code ?? "";
  const react0_manif0_disp1_s = react0_s?.manifestation?.[0]?.coding?.[1]?.display ?? "";
  const react0_manif0_text_s = react0_s?.manifestation?.[0]?.text ?? "";
  const react0_manif1_code0_s = react0_s?.manifestation?.[1]?.coding?.[0]?.code ?? "";
  const react0_manif1_disp0_s = react0_s?.manifestation?.[1]?.coding?.[0]?.display ?? "";
  const react0_manif1_code1_s = react0_s?.manifestation?.[1]?.coding?.[1]?.code ?? "";
  const react0_manif1_disp1_s = react0_s?.manifestation?.[1]?.coding?.[1]?.display ?? "";
  const react0_manif1_text_s = react0_s?.manifestation?.[1]?.text ?? "";
  const react0_note0_txt_s = react0_s?.note?.[0]?.text ?? "";
  const react0_note1_txt_s = react0_s?.note?.[1]?.text ?? "";
  const react1_s = firstSibling?.reaction?.[1];
  const react1_desc_s = react1_s?.description ?? "";
  const react1_onset_s = react1_s?.onset ?? "";
  const react1_severity_s = react1_s?.severity ?? "";
  const react1_subs_code0_s = react1_s?.substance?.coding?.[0]?.code ?? "";
  const react1_subs_disp0_s = react1_s?.substance?.coding?.[0]?.display ?? "";
  const react1_subs_code1_s = react1_s?.substance?.coding?.[1]?.code ?? "";
  const react1_subs_disp1_s = react1_s?.substance?.coding?.[1]?.display ?? "";
  const react1_subs_text_s = react1_s?.substance?.text ?? "";
  const react1_manif0_code0_s = react1_s?.manifestation?.[0]?.coding?.[0]?.code ?? "";
  const react1_manif0_disp0_s = react1_s?.manifestation?.[0]?.coding?.[0]?.display ?? "";
  const react1_manif0_code1_s = react1_s?.manifestation?.[0]?.coding?.[1]?.code ?? "";
  const react1_manif0_disp1_s = react1_s?.manifestation?.[0]?.coding?.[1]?.display ?? "";
  const react1_manif0_text_s = react1_s?.manifestation?.[0]?.text ?? "";
  const react1_manif1_code0_s = react1_s?.manifestation?.[1]?.coding?.[0]?.code ?? "";
  const react1_manif1_disp0_s = react1_s?.manifestation?.[1]?.coding?.[0]?.display ?? "";
  const react1_manif1_code1_s = react1_s?.manifestation?.[1]?.coding?.[1]?.code ?? "";
  const react1_manif1_disp1_s = react1_s?.manifestation?.[1]?.coding?.[1]?.display ?? "";
  const react1_manif1_text_s = react1_s?.manifestation?.[1]?.text ?? "";
  const react1_note0_txt_s = react1_s?.note?.[0]?.text ?? "";
  const react1_note1_txt_s = react1_s?.note?.[1]?.text ?? "";

  const codes = getCode(resource, firstSibling);
  const notes = getNotes(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    clinicStatus,
    clinicStatus_s,
    react0_desc,
    react0_desc_s,
    react0_onset,
    react0_onset_s,
    react0_severity,
    react0_severity_s,
    react0_subs_code0,
    react0_subs_code0_s,
    react0_subs_disp0,
    react0_subs_disp0_s,
    react0_subs_code1,
    react0_subs_code1_s,
    react0_subs_disp1,
    react0_subs_disp1_s,
    react0_subs_text,
    react0_subs_text_s,
    react0_manif0_code0,
    react0_manif0_code0_s,
    react0_manif0_disp0,
    react0_manif0_disp0_s,
    react0_manif0_code1,
    react0_manif0_code1_s,
    react0_manif0_disp1,
    react0_manif0_disp1_s,
    react0_manif0_text,
    react0_manif0_text_s,
    react0_manif1_code0,
    react0_manif1_code0_s,
    react0_manif1_disp0,
    react0_manif1_disp0_s,
    react0_manif1_code1,
    react0_manif1_code1_s,
    react0_manif1_disp1,
    react0_manif1_disp1_s,
    react0_manif1_text,
    react0_manif1_text_s,
    react0_note0_txt,
    react0_note0_txt_s,
    react0_note1_txt,
    react0_note1_txt_s,
    react1_desc,
    react1_desc_s,
    react1_onset,
    react1_onset_s,
    react1_severity,
    react1_severity_s,
    react1_subs_code0,
    react1_subs_code0_s,
    react1_subs_disp0,
    react1_subs_disp0_s,
    react1_subs_code1,
    react1_subs_code1_s,
    react1_subs_disp1,
    react1_subs_disp1_s,
    react1_subs_text,
    react1_subs_text_s,
    react1_manif0_code0,
    react1_manif0_code0_s,
    react1_manif0_disp0,
    react1_manif0_disp0_s,
    react1_manif0_code1,
    react1_manif0_code1_s,
    react1_manif0_disp1,
    react1_manif0_disp1_s,
    react1_manif0_text,
    react1_manif0_text_s,
    react1_manif1_code0,
    react1_manif1_code0_s,
    react1_manif1_disp0,
    react1_manif1_disp0_s,
    react1_manif1_code1,
    react1_manif1_code1_s,
    react1_manif1_disp1,
    react1_manif1_disp1_s,
    react1_manif1_text,
    react1_manif1_text_s,
    react1_note0_txt,
    react1_note0_txt_s,
    react1_note1_txt,
    react1_note1_txt_s,
    type,
    type_s,
    cat0,
    cat0_s,
    cat1,
    cat1_s,
    criticlty,
    criticlty_s,
    ...codes,
    patientRef,
    patientRef_s,
    encounterRef,
    encounterRef_s,
    onsetPeriod_start,
    onsetPeriod_start_s,
    onsetPeriod_end,
    onsetPeriod_end_s,
    recorderRef,
    recorderRef_s,
    ...notes,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
