import { MedicationStatement, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, safeCsv } from "./csv";

// TODO add these when we're ready to compare/analyze them
// dosage0_doseRate0_doseRange_low_value_o,
// dosage0_doseRate0_doseRange_low_unit_o,
// dosage0_doseRate0_doseRange_high_value_o,
// dosage0_doseRate0_doseRange_high_unit_o,
// dosage0_doseRate0_rateRatio_num_val_o,
// dosage0_doseRate0_rateRatio_num_un_o,
// dosage0_doseRate0_rateRatio_den_val_o,
// dosage0_doseRate0_rateRatio_den_un_o,
// dosage0_doseRate0_rateRange_low_val_o,
// dosage0_doseRate0_rateRange_low_un_o,
// dosage0_doseRate0_rateRange_high_val_o,
// dosage0_doseRate0_rateRange_high_un_o,
// dosage0_doseRate0_rateQtty_val_o,
// dosage0_doseRate0_rateQtty_un_o,
// dosage0_maxPeriod_num_val_o,
// dosage0_maxPeriod_num_un_o,
// dosage0_maxPeriod_den_val_o,
// dosage0_maxPeriod_den_un_o,
// dosage0_maxAdmin_val_o,
// dosage0_maxAdmin_un_o,
// dosage0_maxLife_val_o,
// dosage0_maxLife_un_o,
// reason_code0_o,
// reason_display0_o,
// reason_code1_o,
// reason_display1_o,
// reason_text_o,

const columns = [
  "id_o",
  "date",
  "status_o",
  "status_d",
  "medRef_o",
  "medRef_d",
  "subjRef_o",
  "subjRef_d",
  "eDateTime_o",
  "eDateTime_d",
  "ePeriod_start_o",
  "ePeriod_start_d",
  "ePeriod_end_o",
  "ePeriod_end_d",
  "dateAsserted_o",
  "dateAsserted_d",
  "dosage0_text_o",
  "dosage0_text_d",
  "dosage0_route_code0_o",
  "dosage0_route_code0_d",
  "dosage0_route_disp0_o",
  "dosage0_route_disp0_d",
  "dosage0_route_code1_o",
  "dosage0_route_code1_d",
  "dosage0_route_disp1_o",
  "dosage0_route_disp1_d",
  "dosage0_route_text_o",
  "dosage0_route_text_d",
  "dosage0_doseRate0_doseQtty_value_o",
  "dosage0_doseRate0_doseQtty_value_d",
  "dosage0_doseRate0_doseQtty_unit_o",
  "dosage0_doseRate0_doseQtty_unit_d",
  "dosage0_doseRate1_doseQtty_value_o",
  "dosage0_doseRate1_doseQtty_value_d",
  "dosage0_doseRate1_doseQtty_unit_o",
  "dosage0_doseRate1_doseQtty_unit_d",
  "dosage1_text_o",
  "dosage1_text_d",
  "dosage1_route_code0_o",
  "dosage1_route_code0_d",
  "dosage1_route_disp0_o",
  "dosage1_route_disp0_d",
  "dosage1_route_code1_o",
  "dosage1_route_code1_d",
  "dosage1_route_disp1_o",
  "dosage1_route_disp1_d",
  "dosage1_route_text_o",
  "dosage1_route_text_d",
  "dosage1_doseRate0_doseQtty_value_o",
  "dosage1_doseRate0_doseQtty_value_d",
  "dosage1_doseRate0_doseQtty_unit_o",
  "dosage1_doseRate0_doseQtty_unit_d",
  "dosage1_doseRate1_doseQtty_value_o",
  "dosage1_doseRate1_doseQtty_value_d",
  "dosage1_doseRate1_doseQtty_unit_o",
  "dosage1_doseRate1_doseQtty_unit_d",
  "id_d",
] as const;
type Columns = (typeof columns)[number];

export async function processMedicationStatement(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: MedicationStatement[] = (originalDic.MedicationStatement ?? []).flatMap(
    r => (r as MedicationStatement) ?? []
  );
  const dedup: MedicationStatement[] = (dedupDic.MedicationStatement ?? []).flatMap(
    r => (r as MedicationStatement) ?? []
  );

  const originalFileName = patientDirName + `/MedicationStatement-original.csv`;
  const dedupFileName = patientDirName + `/MedicationStatement-dedup.csv`;

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

function sort(a: MedicationStatement, b: MedicationStatement): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: MedicationStatement, siblings: MedicationStatement[]): string {
  const sibling = siblings.find(isEqual(resource));
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const status_o = resource.status ?? "";
  const medRef_o = resource.medicationReference?.reference ?? "";
  const subjRef_o = resource.subject?.reference ?? "";
  const eDateTime_o = resource.effectiveDateTime ?? "";
  const ePeriod_start_o = resource.effectivePeriod?.start ?? "";
  const ePeriod_end_o = resource.effectivePeriod?.end ?? "";
  const dateAsserted_o = resource.dateAsserted ?? "";
  const dosage0 = resource.dosage?.[0];
  const dosage0_text_o = dosage0?.text ?? "";
  const dosage0_route_code0_o = dosage0?.route?.coding?.[0]?.code ?? "";
  const dosage0_route_disp0_o = dosage0?.route?.coding?.[0]?.display ?? "";
  const dosage0_route_code1_o = dosage0?.route?.coding?.[1]?.code ?? "";
  const dosage0_route_disp1_o = dosage0?.route?.coding?.[1]?.display ?? "";
  const dosage0_route_text_o = dosage0?.route?.text ?? "";
  const dosage0_doseRate0_doseQtty_value_o = dosage0?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate0_doseQtty_unit_o = dosage0?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_value_o = dosage0?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_unit_o = dosage0?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1 = resource.dosage?.[1];
  const dosage1_text_o = dosage1?.text ?? "";
  const dosage1_route_code0_o = dosage1?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_route_disp0_o = dosage1?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_route_code1_o = dosage1?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_route_disp1_o = dosage1?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_route_text_o = dosage1?.route?.text ?? "";
  const dosage1_doseRate0_doseQtty_value_o = dosage1?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate0_doseQtty_unit_o = dosage1?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_value_o = dosage1?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_unit_o = dosage1?.doseAndRate?.[1]?.doseQuantity?.value ?? "";

  const status_d = sibling?.status ?? "";
  const medRef_d = sibling?.medicationReference?.reference ?? "";
  const subjRef_d = sibling?.subject?.reference ?? "";
  const eDateTime_d = sibling?.effectiveDateTime ?? "";
  const ePeriod_start_d = sibling?.effectivePeriod?.start ?? "";
  const ePeriod_end_d = sibling?.effectivePeriod?.end ?? "";
  const dateAsserted_d = sibling?.dateAsserted ?? "";
  const dosage0_d = sibling?.dosage?.[0];
  const dosage0_text_d = dosage0_d?.text ?? "";
  const dosage0_route_code0_d = dosage0_d?.route?.coding?.[0]?.code ?? "";
  const dosage0_route_disp0_d = dosage0_d?.route?.coding?.[0]?.display ?? "";
  const dosage0_route_code1_d = dosage0_d?.route?.coding?.[1]?.code ?? "";
  const dosage0_route_disp1_d = dosage0_d?.route?.coding?.[1]?.display ?? "";
  const dosage0_route_text_d = dosage0_d?.route?.text ?? "";
  const dosage0_doseRate0_doseQtty_value_d = dosage0_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate0_doseQtty_unit_d = dosage0_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_value_d = dosage0_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_unit_d = dosage0_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_d = sibling?.dosage?.[1];
  const dosage1_text_d = dosage1_d?.text ?? "";
  const dosage1_route_code0_d = dosage1_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_route_disp0_d = dosage1_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_route_code1_d = dosage1_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_route_disp1_d = dosage1_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_route_text_d = dosage1_d?.route?.text ?? "";
  const dosage1_doseRate0_doseQtty_value_d = dosage1_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate0_doseQtty_unit_d = dosage1_d?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_value_d = dosage1_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_unit_d = dosage1_d?.doseAndRate?.[1]?.doseQuantity?.value ?? "";

  const res: Record<Columns, string | number> = {
    id_o: resource.id ?? "",
    date,
    status_o,
    status_d,
    medRef_o,
    medRef_d,
    subjRef_o,
    subjRef_d,
    eDateTime_o,
    eDateTime_d,
    ePeriod_start_o,
    ePeriod_start_d,
    ePeriod_end_o,
    ePeriod_end_d,
    dateAsserted_o,
    dateAsserted_d,
    dosage0_text_o,
    dosage0_text_d,
    dosage0_route_code0_o,
    dosage0_route_code0_d,
    dosage0_route_disp0_o,
    dosage0_route_disp0_d,
    dosage0_route_code1_o,
    dosage0_route_code1_d,
    dosage0_route_disp1_o,
    dosage0_route_disp1_d,
    dosage0_route_text_o,
    dosage0_route_text_d,
    dosage0_doseRate0_doseQtty_value_o,
    dosage0_doseRate0_doseQtty_value_d,
    dosage0_doseRate0_doseQtty_unit_o,
    dosage0_doseRate0_doseQtty_unit_d,
    dosage0_doseRate1_doseQtty_value_o,
    dosage0_doseRate1_doseQtty_value_d,
    dosage0_doseRate1_doseQtty_unit_o,
    dosage0_doseRate1_doseQtty_unit_d,
    dosage1_text_o,
    dosage1_text_d,
    dosage1_route_code0_o,
    dosage1_route_code0_d,
    dosage1_route_disp0_o,
    dosage1_route_disp0_d,
    dosage1_route_code1_o,
    dosage1_route_code1_d,
    dosage1_route_disp1_o,
    dosage1_route_disp1_d,
    dosage1_route_text_o,
    dosage1_route_text_d,
    dosage1_doseRate0_doseQtty_value_o,
    dosage1_doseRate0_doseQtty_value_d,
    dosage1_doseRate0_doseQtty_unit_o,
    dosage1_doseRate0_doseQtty_unit_d,
    dosage1_doseRate1_doseQtty_value_o,
    dosage1_doseRate1_doseQtty_value_d,
    dosage1_doseRate1_doseQtty_unit_o,
    dosage1_doseRate1_doseQtty_unit_d,
    id_d: sibling?.id ?? "",
  };
  return Object.values(res).map(safeCsv).join(csvSeparator);
}

function isEqual(a: MedicationStatement) {
  return function (b: MedicationStatement): boolean {
    if (a.meta?.lastUpdated || b.meta?.lastUpdated) {
      return a.meta?.lastUpdated === b.meta?.lastUpdated;
    }
    return a.id === b.id;
  };
}
