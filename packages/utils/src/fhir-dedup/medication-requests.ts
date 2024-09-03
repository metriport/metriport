import { MedicationRequest, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, safeCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/medicationrequest.html if you want to add them
const columns = [
  "id_o",
  "date",
  "status_o",
  "status_d",
  "intent_o",
  "intent_d",
  "medRef_o",
  "medRef_d",
  "subjRef_o",
  "subjRef_d",
  "reqRef_o",
  "reqRef_d",
  "perfRef_o",
  "perfRef_d",
  "encounterRef_o",
  "encounterRef_d",
  "recRef_o",
  "recRef_d",
  "authdOn_o",
  "authdOn_d",
  "prio_o",
  "prio_d",
  "doNotPerf_o",
  "doNotPerf_d",
  "cat0_code0_o",
  "cat0_code0_d",
  "cat0_disp0_o",
  "cat0_disp0_d",
  "cat0_code1_o",
  "cat0_code1_d",
  "cat0_disp1_o",
  "cat0_disp1_d",
  "cat0_text_o",
  "cat0_text_d",
  "cat1_code0_o",
  "cat1_code0_d",
  "cat1_disp0_o",
  "cat1_disp0_d",
  "cat1_code1_o",
  "cat1_code1_d",
  "cat1_disp1_o",
  "cat1_disp1_d",
  "cat1_text_o",
  "cat1_text_d",
  "reason0_code0_o",
  "reason0_code0_d",
  "reason0_disp0_o",
  "reason0_disp0_d",
  "reason0_code1_o",
  "reason0_code1_d",
  "reason0_disp1_o",
  "reason0_disp1_d",
  "reason0_text_o",
  "reason0_text_d",
  "reason1_code0_o",
  "reason1_code0_d",
  "reason1_disp0_o",
  "reason1_disp0_d",
  "reason1_code1_o",
  "reason1_code1_d",
  "reason1_disp1_o",
  "reason1_disp1_d",
  "reason1_text_o",
  "reason1_text_d",
  "reasonRef0_o",
  "reasonRef0_d",
  "reasonRef1_o",
  "reasonRef1_d",
  "basedOnRef0_o",
  "basedOnRef0_d",
  "basedOnRef1_o",
  "basedOnRef1_d",
  "note0_txt_o",
  "note0_txt_d",
  "note1_txt_o",
  "note1_txt_d",
  "id_d",
] as const;
type Columns = (typeof columns)[number];

export async function processMedicationRequest(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: MedicationRequest[] = (originalDic.MedicationRequest ?? []).flatMap(
    r => (r as MedicationRequest) ?? []
  );
  const dedup: MedicationRequest[] = (dedupDic.MedicationRequest ?? []).flatMap(
    r => (r as MedicationRequest) ?? []
  );

  const originalFileName = patientDirName + `/MedicationRequest-original.csv`;
  const dedupFileName = patientDirName + `/MedicationRequest-dedup.csv`;

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

function sort(a: MedicationRequest, b: MedicationRequest): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: MedicationRequest, siblings: MedicationRequest[]): string {
  const sibling = siblings.find(isSibling(resource));
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";

  const status_o = resource.status ?? "";
  const intent_o = resource.intent ?? "";
  const medRef_o = resource.medicationReference?.reference ?? "";
  const subjRef_o = resource.subject?.reference ?? "";
  const reqRef_o = resource.requester?.reference ?? "";
  const perfRef_o = resource.performer?.reference ?? "";
  const encounterRef_o = resource.encounter?.reference ?? "";
  const recRef_o = resource.recorder?.reference ?? "";
  const authdOn_o = resource.authoredOn ?? "";
  const prio_o = resource.priority ?? "";
  const doNotPerf_o = resource.doNotPerform ?? "";
  const cat0 = resource.category?.[0];
  const cat0_code0_o = cat0?.coding?.[0]?.code ?? "";
  const cat0_disp0_o = cat0?.coding?.[0]?.display ?? "";
  const cat0_code1_o = cat0?.coding?.[1]?.code ?? "";
  const cat0_disp1_o = cat0?.coding?.[1]?.display ?? "";
  const cat0_text_o = cat0?.text ?? "";
  const cat1 = resource.category?.[0];
  const cat1_code0_o = cat1?.coding?.[0]?.code ?? "";
  const cat1_disp0_o = cat1?.coding?.[0]?.display ?? "";
  const cat1_code1_o = cat1?.coding?.[1]?.code ?? "";
  const cat1_disp1_o = cat1?.coding?.[1]?.display ?? "";
  const cat1_text_o = cat1?.text ?? "";
  const reason0 = resource.reasonCode?.[0];
  const reason0_code0_o = reason0?.coding?.[0]?.code ?? "";
  const reason0_disp0_o = reason0?.coding?.[0]?.display ?? "";
  const reason0_code1_o = reason0?.coding?.[1]?.code ?? "";
  const reason0_disp1_o = reason0?.coding?.[1]?.display ?? "";
  const reason0_text_o = reason0?.text ?? "";
  const reason1 = resource.reasonCode?.[1];
  const reason1_code0_o = reason1?.coding?.[0]?.code ?? "";
  const reason1_disp0_o = reason1?.coding?.[0]?.display ?? "";
  const reason1_code1_o = reason1?.coding?.[1]?.code ?? "";
  const reason1_disp1_o = reason1?.coding?.[1]?.display ?? "";
  const reason1_text_o = reason1?.text ?? "";
  const reasonRef0_o = resource.reasonReference?.[0]?.reference ?? "";
  const reasonRef1_o = resource.reasonReference?.[1]?.reference ?? "";
  const basedOnRef0_o = resource.basedOn?.[0]?.reference ?? "";
  const basedOnRef1_o = resource.basedOn?.[1]?.reference ?? "";
  const note0_txt_o = resource.note?.[0]?.text ?? "";
  const note1_txt_o = resource.note?.[1]?.text ?? "";

  const status_d = sibling?.status ?? "";
  const intent_d = sibling?.intent ?? "";
  const medRef_d = sibling?.medicationReference?.reference ?? "";
  const subjRef_d = sibling?.subject?.reference ?? "";
  const reqRef_d = sibling?.requester?.reference ?? "";
  const perfRef_d = sibling?.performer?.reference ?? "";
  const encounterRef_d = sibling?.encounter?.reference ?? "";
  const recRef_d = sibling?.recorder?.reference ?? "";
  const authdOn_d = sibling?.authoredOn ?? "";
  const prio_d = sibling?.priority ?? "";
  const doNotPerf_d = sibling?.doNotPerform ?? "";
  const cat0_code0_d = sibling?.category?.[0]?.coding?.[0]?.code ?? "";
  const cat0_disp0_d = sibling?.category?.[0]?.coding?.[0]?.display ?? "";
  const cat0_code1_d = sibling?.category?.[0]?.coding?.[1]?.code ?? "";
  const cat0_disp1_d = sibling?.category?.[0]?.coding?.[1]?.display ?? "";
  const cat0_text_d = sibling?.category?.[0]?.text ?? "";
  const cat1_code0_d = sibling?.category?.[1]?.coding?.[0]?.code ?? "";
  const cat1_disp0_d = sibling?.category?.[1]?.coding?.[0]?.display ?? "";
  const cat1_code1_d = sibling?.category?.[1]?.coding?.[1]?.code ?? "";
  const cat1_disp1_d = sibling?.category?.[1]?.coding?.[1]?.display ?? "";
  const cat1_text_d = sibling?.category?.[1]?.text ?? "";
  const reason0_code0_d = sibling?.reasonCode?.[0]?.coding?.[0]?.code ?? "";
  const reason0_disp0_d = sibling?.reasonCode?.[0]?.coding?.[0]?.display ?? "";
  const reason0_code1_d = sibling?.reasonCode?.[0]?.coding?.[1]?.code ?? "";
  const reason0_disp1_d = sibling?.reasonCode?.[0]?.coding?.[1]?.display ?? "";
  const reason0_text_d = sibling?.reasonCode?.[0]?.text ?? "";
  const reason1_code0_d = sibling?.reasonCode?.[1]?.coding?.[0]?.code ?? "";
  const reason1_disp0_d = sibling?.reasonCode?.[1]?.coding?.[0]?.display ?? "";
  const reason1_code1_d = sibling?.reasonCode?.[1]?.coding?.[1]?.code ?? "";
  const reason1_disp1_d = sibling?.reasonCode?.[1]?.coding?.[1]?.display ?? "";
  const reason1_text_d = sibling?.reasonCode?.[1]?.text ?? "";
  const reasonRef0_d = sibling?.reasonReference?.[0]?.reference ?? "";
  const reasonRef1_d = sibling?.reasonReference?.[1]?.reference ?? "";
  const basedOnRef0_d = sibling?.basedOn?.[0]?.reference ?? "";
  const basedOnRef1_d = sibling?.basedOn?.[1]?.reference ?? "";
  const note0_txt_d = sibling?.note?.[0]?.text ?? "";
  const note1_txt_d = sibling?.note?.[1]?.text ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id_o: resource.id ?? "",
    date,
    status_o,
    status_d,
    intent_o,
    intent_d,
    medRef_o,
    medRef_d,
    subjRef_o,
    subjRef_d,
    reqRef_o,
    reqRef_d,
    perfRef_o,
    perfRef_d,
    encounterRef_o,
    encounterRef_d,
    recRef_o,
    recRef_d,
    authdOn_o,
    authdOn_d,
    prio_o,
    prio_d,
    doNotPerf_o,
    doNotPerf_d,
    cat0_code0_o,
    cat0_code0_d,
    cat1_code0_o,
    cat1_code0_d,
    cat0_disp0_o,
    cat0_disp0_d,
    cat1_disp0_o,
    cat1_disp0_d,
    cat0_code1_o,
    cat0_code1_d,
    cat1_code1_o,
    cat1_code1_d,
    cat0_disp1_o,
    cat0_disp1_d,
    cat1_disp1_o,
    cat1_disp1_d,
    cat0_text_o,
    cat0_text_d,
    cat1_text_o,
    cat1_text_d,
    reason0_code0_o,
    reason0_code0_d,
    reason1_code0_o,
    reason1_code0_d,
    reason0_disp0_o,
    reason0_disp0_d,
    reason1_disp0_o,
    reason1_disp0_d,
    reason0_code1_o,
    reason0_code1_d,
    reason1_code1_o,
    reason1_code1_d,
    reason0_disp1_o,
    reason0_disp1_d,
    reason1_disp1_o,
    reason1_disp1_d,
    reason0_text_o,
    reason0_text_d,
    reason1_text_o,
    reason1_text_d,
    reasonRef0_o,
    reasonRef0_d,
    reasonRef1_o,
    reasonRef1_d,
    basedOnRef0_o,
    basedOnRef0_d,
    basedOnRef1_o,
    basedOnRef1_d,
    note0_txt_o,
    note0_txt_d,
    note1_txt_o,
    note1_txt_d,
    id_d: sibling?.id ?? "",
  };
  return Object.values(res).map(safeCsv).join(csvSeparator);
}
