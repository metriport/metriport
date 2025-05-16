import { MedicationAdministration, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import {
  category0Columns,
  effectiveDateTimeColumns,
  effectivePeriodColumns,
  getCategory,
  getEffectiveDateTime,
  getEffectivePeriod,
  getNotes,
  getReasonCode,
  getReasonReference,
  notesColumns,
  reasonCodeColumns,
  reasonReferenceColumns,
} from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/medicationadministration.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "medRef",
  "medRef_s",
  "subjRef",
  "subjRef_s",
  "reqRef",
  "reqRef_s",
  "ctxtRef",
  "ctxtRef_s",
  "perfActorRef0",
  "perfActorRef0_s",
  "perfActorRef1",
  "perfActorRef1_s",
  ...effectiveDateTimeColumns,
  ...effectivePeriodColumns,
  "dosage_text",
  "dosage_text_s",
  "dosage_route_code0",
  "dosage_route_code0_s",
  "dosage_route_disp0",
  "dosage_route_disp0_s",
  "dosage_route_code1",
  "dosage_route_code1_s",
  "dosage_route_disp1",
  "dosage_route_disp1_s",
  "dosage_route_text",
  "dosage_route_text_s",
  "dosage_dose_value",
  "dosage_dose_value_s",
  "dosage_dose_unit",
  "dosage_dose_unit_s",
  ...category0Columns,
  ...reasonCodeColumns,
  ...reasonReferenceColumns,
  ...notesColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processMedicationAdministration(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: MedicationAdministration[] = (originalDic.MedicationAdministration ?? []).flatMap(
    r => (r as MedicationAdministration) ?? []
  );
  const dedup: MedicationAdministration[] = (dedupDic.MedicationAdministration ?? []).flatMap(
    r => (r as MedicationAdministration) ?? []
  );

  const originalFileName = patientDirName + `/MedicationAdministration-original.csv`;
  const dedupFileName = patientDirName + `/MedicationAdministration-dedup.csv`;

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

function sort(a: MedicationAdministration, b: MedicationAdministration): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: MedicationAdministration, others: MedicationAdministration[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const medRef = resource.medicationReference?.reference ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const reqRef = resource.request?.reference ?? "";
  const perfActorRef0 = resource.performer?.[0]?.actor?.reference ?? "";
  const perfActorRef1 = resource.performer?.[1]?.actor?.reference ?? "";
  const ctxtRef = resource.context?.reference ?? "";
  const dosage = resource.dosage;
  const dosage_text = dosage?.text ?? "";
  const dosage_route_code0 = dosage?.route?.coding?.[0]?.code ?? "";
  const dosage_route_disp0 = dosage?.route?.coding?.[0]?.display ?? "";
  const dosage_route_code1 = dosage?.route?.coding?.[1]?.code ?? "";
  const dosage_route_disp1 = dosage?.route?.coding?.[1]?.display ?? "";
  const dosage_route_text = dosage?.route?.text ?? "";
  const dosage_dose_value = dosage?.dose?.value ?? "";
  const dosage_dose_unit = dosage?.dose?.unit ?? "";

  const status_s = firstSibling?.status ?? "";
  const medRef_s = firstSibling?.medicationReference?.reference ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const reqRef_s = firstSibling?.request?.reference ?? "";
  const perfActorRef0_s = firstSibling?.performer?.[0]?.actor?.reference ?? "";
  const perfActorRef1_s = firstSibling?.performer?.[1]?.actor?.reference ?? "";
  const ctxtRef_s = firstSibling?.context?.reference ?? "";
  const dosage_s = firstSibling?.dosage;
  const dosage_text_s = dosage_s?.text ?? "";
  const dosage_route_code0_s = dosage_s?.route?.coding?.[0]?.code ?? "";
  const dosage_route_disp0_s = dosage_s?.route?.coding?.[0]?.display ?? "";
  const dosage_route_code1_s = dosage_s?.route?.coding?.[1]?.code ?? "";
  const dosage_route_disp1_s = dosage_s?.route?.coding?.[1]?.display ?? "";
  const dosage_route_text_s = dosage_s?.route?.text ?? "";
  const dosage_dose_value_s = dosage_s?.dose?.value ?? "";
  const dosage_dose_unit_s = dosage_s?.dose?.unit ?? "";

  const category = getCategory(resource, firstSibling);
  const effectiveDateTime = getEffectiveDateTime(resource, firstSibling);
  const effectivePeriod = getEffectivePeriod(resource, firstSibling);
  const reasonCodes = getReasonCode(resource, firstSibling);
  const reasonReferences = getReasonReference(resource, firstSibling);
  const notes = getNotes(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    medRef,
    medRef_s,
    subjRef,
    subjRef_s,
    reqRef,
    reqRef_s,
    ctxtRef,
    ctxtRef_s,
    perfActorRef0,
    perfActorRef0_s,
    perfActorRef1,
    perfActorRef1_s,
    ...effectiveDateTime,
    ...effectivePeriod,
    dosage_text,
    dosage_text_s,
    dosage_route_code0,
    dosage_route_code0_s,
    dosage_route_disp0,
    dosage_route_disp0_s,
    dosage_route_code1,
    dosage_route_code1_s,
    dosage_route_disp1,
    dosage_route_disp1_s,
    dosage_route_text,
    dosage_route_text_s,
    dosage_dose_value,
    dosage_dose_value_s,
    dosage_dose_unit,
    dosage_dose_unit_s,
    ...category,
    ...reasonCodes,
    ...reasonReferences,
    ...notes,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
