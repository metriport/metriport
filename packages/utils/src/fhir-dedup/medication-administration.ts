import { MedicationAdministration, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, safeCsv } from "./csv";
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

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/medicationadministration.html if you want to add them
const columns = [
  "id_o",
  "date",
  "status_o",
  "status_d",
  "medRef_o",
  "medRef_d",
  "subjRef_o",
  "subjRef_d",
  "reqRef_o",
  "reqRef_d",
  "ctxtRef_o",
  "ctxtRef_d",
  "perfActorRef0_o",
  "perfActorRef0_d",
  "perfActorRef1_o",
  "perfActorRef1_d",
  ...effectiveDateTimeColumns,
  ...effectivePeriodColumns,
  "dosage_text_o",
  "dosage_text_d",
  "dosage_route_code0_o",
  "dosage_route_code0_d",
  "dosage_route_disp0_o",
  "dosage_route_disp0_d",
  "dosage_route_code1_o",
  "dosage_route_code1_d",
  "dosage_route_disp1_o",
  "dosage_route_disp1_d",
  "dosage_route_text_o",
  "dosage_route_text_d",
  "dosage_dose_value_o",
  "dosage_dose_value_d",
  "dosage_dose_unit_o",
  "dosage_dose_unit_d",
  ...category0Columns,
  ...reasonCodeColumns,
  ...reasonReferenceColumns,
  ...notesColumns,
  "id_d",
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

function toCsv(resource: MedicationAdministration, siblings: MedicationAdministration[]): string {
  const sibling = siblings.find(isEqual(resource));
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";

  const status_o = resource.status ?? "";
  const medRef_o = resource.medicationReference?.reference ?? "";
  const subjRef_o = resource.subject?.reference ?? "";
  const reqRef_o = resource.request?.reference ?? "";
  const perfActorRef0_o = resource.performer?.[0]?.actor?.reference ?? "";
  const perfActorRef1_o = resource.performer?.[1]?.actor?.reference ?? "";
  const ctxtRef_o = resource.context?.reference ?? "";
  const dosage = resource.dosage;
  const dosage_text_o = dosage?.text ?? "";
  const dosage_route_code0_o = dosage?.route?.coding?.[0]?.code ?? "";
  const dosage_route_disp0_o = dosage?.route?.coding?.[0]?.display ?? "";
  const dosage_route_code1_o = dosage?.route?.coding?.[1]?.code ?? "";
  const dosage_route_disp1_o = dosage?.route?.coding?.[1]?.display ?? "";
  const dosage_route_text_o = dosage?.route?.text ?? "";
  const dosage_dose_value_o = dosage?.dose?.value ?? "";
  const dosage_dose_unit_o = dosage?.dose?.unit ?? "";

  const status_d = sibling?.status ?? "";
  const medRef_d = sibling?.medicationReference?.reference ?? "";
  const subjRef_d = sibling?.subject?.reference ?? "";
  const reqRef_d = sibling?.request?.reference ?? "";
  const perfActorRef0_d = sibling?.performer?.[0]?.actor?.reference ?? "";
  const perfActorRef1_d = sibling?.performer?.[1]?.actor?.reference ?? "";
  const ctxtRef_d = sibling?.context?.reference ?? "";
  const dosage_d = sibling?.dosage;
  const dosage_text_d = dosage_d?.text ?? "";
  const dosage_route_code0_d = dosage_d?.route?.coding?.[0]?.code ?? "";
  const dosage_route_disp0_d = dosage_d?.route?.coding?.[0]?.display ?? "";
  const dosage_route_code1_d = dosage_d?.route?.coding?.[1]?.code ?? "";
  const dosage_route_disp1_d = dosage_d?.route?.coding?.[1]?.display ?? "";
  const dosage_route_text_d = dosage_d?.route?.text ?? "";
  const dosage_dose_value_d = dosage_d?.dose?.value ?? "";
  const dosage_dose_unit_d = dosage_d?.dose?.unit ?? "";

  const category = getCategory(resource, sibling);
  const effectiveDateTime = getEffectiveDateTime(resource, sibling);
  const effectivePeriod = getEffectivePeriod(resource, sibling);
  const reasonCodes = getReasonCode(resource, sibling);
  const reasonReferences = getReasonReference(resource, sibling);
  const notes = getNotes(resource, sibling);

  const res: Record<Columns, string | number | boolean> = {
    id_o: resource.id ?? "",
    date,
    status_o,
    status_d,
    medRef_o,
    medRef_d,
    subjRef_o,
    subjRef_d,
    reqRef_o,
    reqRef_d,
    ctxtRef_o,
    ctxtRef_d,
    perfActorRef0_o,
    perfActorRef0_d,
    perfActorRef1_o,
    perfActorRef1_d,
    ...effectiveDateTime,
    ...effectivePeriod,
    dosage_text_o,
    dosage_text_d,
    dosage_route_code0_o,
    dosage_route_code0_d,
    dosage_route_disp0_o,
    dosage_route_disp0_d,
    dosage_route_code1_o,
    dosage_route_code1_d,
    dosage_route_disp1_o,
    dosage_route_disp1_d,
    dosage_route_text_o,
    dosage_route_text_d,
    dosage_dose_value_o,
    dosage_dose_value_d,
    dosage_dose_unit_o,
    dosage_dose_unit_d,
    ...category,
    ...reasonCodes,
    ...reasonReferences,
    ...notes,
    id_d: sibling?.id ?? "",
  };
  return Object.values(res).map(safeCsv).join(csvSeparator);
}

function isEqual(a: MedicationAdministration) {
  return function (b: MedicationAdministration): boolean {
    if (a.meta?.lastUpdated || b.meta?.lastUpdated) {
      return a.meta?.lastUpdated === b.meta?.lastUpdated;
    }
    return a.id === b.id;
  };
}
