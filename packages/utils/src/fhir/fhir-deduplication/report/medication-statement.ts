import { MedicationStatement, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

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
  "eDateTime",
  "eDateTime_s",
  "ePeriod_dtart",
  "ePeriod_dtart_s",
  "ePeriod_end",
  "ePeriod_end_s",
  "dateAsserted",
  "dateAsserted_s",
  "dosage0_text",
  "dosage0_text_s",
  "dosage0_route_code0",
  "dosage0_route_code0_s",
  "dosage0_route_disp0",
  "dosage0_route_disp0_s",
  "dosage0_route_code1",
  "dosage0_route_code1_s",
  "dosage0_route_disp1",
  "dosage0_route_disp1_s",
  "dosage0_route_text",
  "dosage0_route_text_s",
  "dosage0_doseRate0_doseQtty_value",
  "dosage0_doseRate0_doseQtty_value_s",
  "dosage0_doseRate0_doseQtty_unit",
  "dosage0_doseRate0_doseQtty_unit_s",
  "dosage0_doseRate1_doseQtty_value",
  "dosage0_doseRate1_doseQtty_value_s",
  "dosage0_doseRate1_doseQtty_unit",
  "dosage0_doseRate1_doseQtty_unit_s",
  "dosage1_text",
  "dosage1_text_s",
  "dosage1_route_code0",
  "dosage1_route_code0_s",
  "dosage1_route_disp0",
  "dosage1_route_disp0_s",
  "dosage1_route_code1",
  "dosage1_route_code1_s",
  "dosage1_route_disp1",
  "dosage1_route_disp1_s",
  "dosage1_route_text",
  "dosage1_route_text_s",
  "dosage1_doseRate0_doseQtty_value",
  "dosage1_doseRate0_doseQtty_value_s",
  "dosage1_doseRate0_doseQtty_unit",
  "dosage1_doseRate0_doseQtty_unit_s",
  "dosage1_doseRate1_doseQtty_value",
  "dosage1_doseRate1_doseQtty_value_s",
  "dosage1_doseRate1_doseQtty_unit",
  "dosage1_doseRate1_doseQtty_unit_s",
  "ids_siblings",
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

function toCsv(resource: MedicationStatement, others: MedicationStatement[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const medRef = resource.medicationReference?.reference ?? "";
  const subjRef = resource.subject?.reference ?? "";
  const eDateTime = resource.effectiveDateTime ?? "";
  const ePeriod_dtart = resource.effectivePeriod?.start ?? "";
  const ePeriod_end = resource.effectivePeriod?.end ?? "";
  const dateAsserted = resource.dateAsserted ?? "";
  const dosage0 = resource.dosage?.[0];
  const dosage0_text = dosage0?.text ?? "";
  const dosage0_route_code0 = dosage0?.route?.coding?.[0]?.code ?? "";
  const dosage0_route_disp0 = dosage0?.route?.coding?.[0]?.display ?? "";
  const dosage0_route_code1 = dosage0?.route?.coding?.[1]?.code ?? "";
  const dosage0_route_disp1 = dosage0?.route?.coding?.[1]?.display ?? "";
  const dosage0_route_text = dosage0?.route?.text ?? "";
  const dosage0_doseRate0_doseQtty_value = dosage0?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate0_doseQtty_unit = dosage0?.doseAndRate?.[0]?.doseQuantity?.unit ?? "";
  const dosage0_doseRate1_doseQtty_value = dosage0?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_unit = dosage0?.doseAndRate?.[1]?.doseQuantity?.unit ?? "";
  const dosage1 = resource.dosage?.[1];
  const dosage1_text = dosage1?.text ?? "";
  const dosage1_route_code0 = dosage1?.route?.coding?.[0]?.code ?? "";
  const dosage1_route_disp0 = dosage1?.route?.coding?.[0]?.display ?? "";
  const dosage1_route_code1 = dosage1?.route?.coding?.[1]?.code ?? "";
  const dosage1_route_disp1 = dosage1?.route?.coding?.[1]?.display ?? "";
  const dosage1_route_text = dosage1?.route?.text ?? "";
  const dosage1_doseRate0_doseQtty_value = dosage1?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate0_doseQtty_unit = dosage1?.doseAndRate?.[0]?.doseQuantity?.unit ?? "";
  const dosage1_doseRate1_doseQtty_value = dosage1?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_unit = dosage1?.doseAndRate?.[1]?.doseQuantity?.unit ?? "";

  const status_s = firstSibling?.status ?? "";
  const medRef_s = firstSibling?.medicationReference?.reference ?? "";
  const subjRef_s = firstSibling?.subject?.reference ?? "";
  const eDateTime_s = firstSibling?.effectiveDateTime ?? "";
  const ePeriod_dtart_s = firstSibling?.effectivePeriod?.start ?? "";
  const ePeriod_end_s = firstSibling?.effectivePeriod?.end ?? "";
  const dateAsserted_s = firstSibling?.dateAsserted ?? "";
  const dosage0_s = firstSibling?.dosage?.[0];
  const dosage0_text_s = dosage0_s?.text ?? "";
  const dosage0_route_code0_s = dosage0_s?.route?.coding?.[0]?.code ?? "";
  const dosage0_route_disp0_s = dosage0_s?.route?.coding?.[0]?.display ?? "";
  const dosage0_route_code1_s = dosage0_s?.route?.coding?.[1]?.code ?? "";
  const dosage0_route_disp1_s = dosage0_s?.route?.coding?.[1]?.display ?? "";
  const dosage0_route_text_s = dosage0_s?.route?.text ?? "";
  const dosage0_doseRate0_doseQtty_value_s = dosage0_s?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage0_doseRate0_doseQtty_unit_s = dosage0_s?.doseAndRate?.[0]?.doseQuantity?.unit ?? "";
  const dosage0_doseRate1_doseQtty_value_s = dosage0_s?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage0_doseRate1_doseQtty_unit_s = dosage0_s?.doseAndRate?.[1]?.doseQuantity?.unit ?? "";
  const dosage1_s = firstSibling?.dosage?.[1];
  const dosage1_text_s = dosage1_s?.text ?? "";
  const dosage1_route_code0_s = dosage1_s?.route?.coding?.[0]?.code ?? "";
  const dosage1_route_disp0_s = dosage1_s?.route?.coding?.[0]?.display ?? "";
  const dosage1_route_code1_s = dosage1_s?.route?.coding?.[1]?.code ?? "";
  const dosage1_route_disp1_s = dosage1_s?.route?.coding?.[1]?.display ?? "";
  const dosage1_route_text_s = dosage1_s?.route?.text ?? "";
  const dosage1_doseRate0_doseQtty_value_s = dosage1_s?.doseAndRate?.[0]?.doseQuantity?.value ?? "";
  const dosage1_doseRate0_doseQtty_unit_s = dosage1_s?.doseAndRate?.[0]?.doseQuantity?.unit ?? "";
  const dosage1_doseRate1_doseQtty_value_s = dosage1_s?.doseAndRate?.[1]?.doseQuantity?.value ?? "";
  const dosage1_doseRate1_doseQtty_unit_s = dosage1_s?.doseAndRate?.[1]?.doseQuantity?.unit ?? "";

  const res: Record<Columns, string | number> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    medRef,
    medRef_s,
    subjRef,
    subjRef_s,
    eDateTime,
    eDateTime_s,
    ePeriod_dtart,
    ePeriod_dtart_s,
    ePeriod_end,
    ePeriod_end_s,
    dateAsserted,
    dateAsserted_s,
    dosage0_text,
    dosage0_text_s,
    dosage0_route_code0,
    dosage0_route_code0_s,
    dosage0_route_disp0,
    dosage0_route_disp0_s,
    dosage0_route_code1,
    dosage0_route_code1_s,
    dosage0_route_disp1,
    dosage0_route_disp1_s,
    dosage0_route_text,
    dosage0_route_text_s,
    dosage0_doseRate0_doseQtty_value,
    dosage0_doseRate0_doseQtty_value_s,
    dosage0_doseRate0_doseQtty_unit,
    dosage0_doseRate0_doseQtty_unit_s,
    dosage0_doseRate1_doseQtty_value,
    dosage0_doseRate1_doseQtty_value_s,
    dosage0_doseRate1_doseQtty_unit,
    dosage0_doseRate1_doseQtty_unit_s,
    dosage1_text,
    dosage1_text_s,
    dosage1_route_code0,
    dosage1_route_code0_s,
    dosage1_route_disp0,
    dosage1_route_disp0_s,
    dosage1_route_code1,
    dosage1_route_code1_s,
    dosage1_route_disp1,
    dosage1_route_disp1_s,
    dosage1_route_text,
    dosage1_route_text_s,
    dosage1_doseRate0_doseQtty_value,
    dosage1_doseRate0_doseQtty_value_s,
    dosage1_doseRate0_doseQtty_unit,
    dosage1_doseRate0_doseQtty_unit_s,
    dosage1_doseRate1_doseQtty_value,
    dosage1_doseRate1_doseQtty_value_s,
    dosage1_doseRate1_doseQtty_unit,
    dosage1_doseRate1_doseQtty_unit_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
