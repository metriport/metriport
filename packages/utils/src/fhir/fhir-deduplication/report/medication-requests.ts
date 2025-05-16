import { MedicationRequest, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/medicationrequest.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "intent",
  "intent_s",
  "medRef",
  "medRef_s",
  "subjRef",
  "subjRef_s",
  "reqRef",
  "reqRef_s",
  "perfRef",
  "perfRef_s",
  "encounterRef",
  "encounterRef_s",
  "recRef",
  "recRef_s",
  "authdOn",
  "authdOn_s",
  "prio",
  "prio_s",
  "doNotPerf",
  "doNotPerf_s",
  "cat0_code0",
  "cat0_code0_s",
  "cat0_disp0",
  "cat0_disp0_s",
  "cat0_code1",
  "cat0_code1_s",
  "cat0_disp1",
  "cat0_disp1_s",
  "cat0_text",
  "cat0_text_s",
  "cat1_code0",
  "cat1_code0_s",
  "cat1_disp0",
  "cat1_disp0_s",
  "cat1_code1",
  "cat1_code1_s",
  "cat1_disp1",
  "cat1_disp1_s",
  "cat1_text",
  "cat1_text_s",
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
  "basedOnRef0",
  "basedOnRef0_s",
  "basedOnRef1",
  "basedOnRef1_s",
  "note0_txt",
  "note0_txt_s",
  "note1_txt",
  "note1_txt_s",
  "ids_siblings",
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

function toCsv(resource: MedicationRequest, others: MedicationRequest[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const intent = resource.intent ?? "";
  const medRef = resource.medicationReference?.reference ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const reqRef = resource.requester?.reference ?? "";
  const perfRef = resource.performer?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const recRef = resource.recorder?.reference ?? "";
  const authdOn = resource.authoredOn ?? "";
  const prio = resource.priority ?? "";
  const doNotPerf = resource.doNotPerform ?? "";
  const cat0 = resource.category?.[0];
  const cat0_code0 = cat0?.coding?.[0]?.code ?? "";
  const cat0_disp0 = cat0?.coding?.[0]?.display ?? "";
  const cat0_code1 = cat0?.coding?.[1]?.code ?? "";
  const cat0_disp1 = cat0?.coding?.[1]?.display ?? "";
  const cat0_text = cat0?.text ?? "";
  const cat1 = resource.category?.[0];
  const cat1_code0 = cat1?.coding?.[0]?.code ?? "";
  const cat1_disp0 = cat1?.coding?.[0]?.display ?? "";
  const cat1_code1 = cat1?.coding?.[1]?.code ?? "";
  const cat1_disp1 = cat1?.coding?.[1]?.display ?? "";
  const cat1_text = cat1?.text ?? "";
  const reason0 = resource.reasonCode?.[0];
  const reason0_code0 = reason0?.coding?.[0]?.code ?? "";
  const reason0_disp0 = reason0?.coding?.[0]?.display ?? "";
  const reason0_code1 = reason0?.coding?.[1]?.code ?? "";
  const reason0_disp1 = reason0?.coding?.[1]?.display ?? "";
  const reason0_text = reason0?.text ?? "";
  const reason1 = resource.reasonCode?.[1];
  const reason1_code0 = reason1?.coding?.[0]?.code ?? "";
  const reason1_disp0 = reason1?.coding?.[0]?.display ?? "";
  const reason1_code1 = reason1?.coding?.[1]?.code ?? "";
  const reason1_disp1 = reason1?.coding?.[1]?.display ?? "";
  const reason1_text = reason1?.text ?? "";
  const reasonRef0 = resource.reasonReference?.[0]?.reference ?? "";
  const reasonRef1 = resource.reasonReference?.[1]?.reference ?? "";
  const basedOnRef0 = resource.basedOn?.[0]?.reference ?? "";
  const basedOnRef1 = resource.basedOn?.[1]?.reference ?? "";
  const note0_txt = resource.note?.[0]?.text ?? "";
  const note1_txt = resource.note?.[1]?.text ?? "";

  const status_s = firstSibling?.status ?? "";
  const intent_s = firstSibling?.intent ?? "";
  const medRef_s = firstSibling?.medicationReference?.reference ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const reqRef_s = firstSibling?.requester?.reference ?? "";
  const perfRef_s = firstSibling?.performer?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const recRef_s = firstSibling?.recorder?.reference ?? "";
  const authdOn_s = firstSibling?.authoredOn ?? "";
  const prio_s = firstSibling?.priority ?? "";
  const doNotPerf_s = firstSibling?.doNotPerform ?? "";
  const cat0_code0_s = firstSibling?.category?.[0]?.coding?.[0]?.code ?? "";
  const cat0_disp0_s = firstSibling?.category?.[0]?.coding?.[0]?.display ?? "";
  const cat0_code1_s = firstSibling?.category?.[0]?.coding?.[1]?.code ?? "";
  const cat0_disp1_s = firstSibling?.category?.[0]?.coding?.[1]?.display ?? "";
  const cat0_text_s = firstSibling?.category?.[0]?.text ?? "";
  const cat1_code0_s = firstSibling?.category?.[1]?.coding?.[0]?.code ?? "";
  const cat1_disp0_s = firstSibling?.category?.[1]?.coding?.[0]?.display ?? "";
  const cat1_code1_s = firstSibling?.category?.[1]?.coding?.[1]?.code ?? "";
  const cat1_disp1_s = firstSibling?.category?.[1]?.coding?.[1]?.display ?? "";
  const cat1_text_s = firstSibling?.category?.[1]?.text ?? "";
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
  const basedOnRef0_s = firstSibling?.basedOn?.[0]?.reference ?? "";
  const basedOnRef1_s = firstSibling?.basedOn?.[1]?.reference ?? "";
  const note0_txt_s = firstSibling?.note?.[0]?.text ?? "";
  const note1_txt_s = firstSibling?.note?.[1]?.text ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    intent,
    intent_s,
    medRef,
    medRef_s,
    subjRef,
    subjRef_s,
    reqRef,
    reqRef_s,
    perfRef,
    perfRef_s,
    encounterRef,
    encounterRef_s,
    recRef,
    recRef_s,
    authdOn,
    authdOn_s,
    prio,
    prio_s,
    doNotPerf,
    doNotPerf_s,
    cat0_code0,
    cat0_code0_s,
    cat1_code0,
    cat1_code0_s,
    cat0_disp0,
    cat0_disp0_s,
    cat1_disp0,
    cat1_disp0_s,
    cat0_code1,
    cat0_code1_s,
    cat1_code1,
    cat1_code1_s,
    cat0_disp1,
    cat0_disp1_s,
    cat1_disp1,
    cat1_disp1_s,
    cat0_text,
    cat0_text_s,
    cat1_text,
    cat1_text_s,
    reason0_code0,
    reason0_code0_s,
    reason1_code0,
    reason1_code0_s,
    reason0_disp0,
    reason0_disp0_s,
    reason1_disp0,
    reason1_disp0_s,
    reason0_code1,
    reason0_code1_s,
    reason1_code1,
    reason1_code1_s,
    reason0_disp1,
    reason0_disp1_s,
    reason1_disp1,
    reason1_disp1_s,
    reason0_text,
    reason0_text_s,
    reason1_text,
    reason1_text_s,
    reasonRef0,
    reasonRef0_s,
    reasonRef1,
    reasonRef1_s,
    basedOnRef0,
    basedOnRef0_s,
    basedOnRef1,
    basedOnRef1_s,
    note0_txt,
    note0_txt_s,
    note1_txt,
    note1_txt_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
