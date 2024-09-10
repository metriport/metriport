import { Immunization, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { getNotes, notesColumns } from "./resource-props";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/immunization.html if you want to add them
const columns = [
  "id",
  "date",
  "links",
  "status",
  "status_s",
  "vaccineCode_code0",
  "vaccineCode_code0_s",
  "vaccineCode_disp0",
  "vaccineCode_disp0_s",
  "vaccineCode_code1",
  "vaccineCode_code1_s",
  "vaccineCode_disp1",
  "vaccineCode_disp1_s",
  "vaccineCode_text",
  "vaccineCode_text_s",
  "patientRef",
  "patientRef_s",
  "encounterRef",
  "encounterRef_s",
  "occurDateTime",
  "occurDateTime_s",
  "locatRef",
  "locatRef_s",
  "manufRef",
  "manufRef_s",
  "lotNumber",
  "lotNumber_s",
  "site_code0",
  "site_code0_s",
  "site_disp0",
  "site_disp0_s",
  "site_code1",
  "site_code1_s",
  "site_disp1",
  "site_disp1_s",
  "site_text",
  "site_text_s",
  "route_code0",
  "route_code0_s",
  "route_disp0",
  "route_disp0_s",
  "route_code1",
  "route_code1_s",
  "route_disp1",
  "route_disp1_s",
  "route_text",
  "route_text_s",
  "doseQtty_val",
  "doseQtty_val_s",
  "doseQtty_unit",
  "doseQtty_unit_s",
  "performerRef",
  "performerRef_s",
  "performerFunc",
  "performerFunc_s",
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
  "react0_date",
  "react0_date_s",
  "react0_detail",
  "react0_detail_s",
  "react0_reported",
  "react0_reported_s",
  "react1_date",
  "react1_date_s",
  "react1_detail",
  "react1_detail_s",
  "react1_reported",
  "react1_reported_s",
  ...notesColumns,
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processImmunization(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Immunization[] = (originalDic.Immunization ?? []).flatMap(
    r => (r as Immunization) ?? []
  );
  const dedup: Immunization[] = (dedupDic.Immunization ?? []).flatMap(
    r => (r as Immunization) ?? []
  );

  const originalFileName = patientDirName + `/Immunization-original.csv`;
  const dedupFileName = patientDirName + `/Immunization-dedup.csv`;

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

function sort(a: Immunization, b: Immunization): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Immunization, others: Immunization[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const vaccineCode_code0 = resource.vaccineCode?.coding?.[0]?.code ?? "";
  const vaccineCode_disp0 = resource.vaccineCode?.coding?.[0]?.display ?? "";
  const vaccineCode_code1 = resource.vaccineCode?.coding?.[1]?.code ?? "";
  const vaccineCode_disp1 = resource.vaccineCode?.coding?.[1]?.display ?? "";
  const vaccineCode_text = resource.vaccineCode?.text ?? "";
  const patientRef = resource.patient?.reference ?? "";
  const encounterRef = resource.encounter?.reference ?? "";
  const occurDateTime = resource.occurrenceDateTime ?? "";
  const locatRef = resource.location?.reference ?? "";
  const manufRef = resource.manufacturer?.reference ?? "";
  const lotNumber = resource.lotNumber ?? "";
  const site_code0 = resource.site?.coding?.[0]?.code ?? "";
  const site_disp0 = resource.site?.coding?.[0]?.display ?? "";
  const site_code1 = resource.site?.coding?.[1]?.code ?? "";
  const site_disp1 = resource.site?.coding?.[1]?.display ?? "";
  const site_text = resource.site?.text ?? "";
  const route_code0 = resource.route?.coding?.[0]?.code ?? "";
  const route_disp0 = resource.route?.coding?.[0]?.display ?? "";
  const route_code1 = resource.route?.coding?.[1]?.code ?? "";
  const route_disp1 = resource.route?.coding?.[1]?.display ?? "";
  const route_text = resource.route?.text ?? "";
  const doseQtty_val = resource.doseQuantity?.value ?? "";
  const doseQtty_unit = resource.doseQuantity?.unit ?? "";
  const performerRef = resource.performer?.[0]?.actor?.reference ?? "";
  const performerFunc = resource.performer?.[0]?.function?.coding?.[0]?.code ?? "";
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
  const react0_date = resource.reaction?.[0]?.date ?? "";
  const react0_detail = resource.reaction?.[0]?.detail?.reference ?? "";
  const react0_reported = resource.reaction?.[0]?.reported ?? "";
  const react1_date = resource.reaction?.[1]?.date ?? "";
  const react1_detail = resource.reaction?.[1]?.detail?.reference ?? "";
  const react1_reported = resource.reaction?.[1]?.reported ?? "";

  const status_s = firstSibling?.status ?? "";
  const vaccineCode_code0_s = firstSibling?.vaccineCode?.coding?.[0]?.code ?? "";
  const vaccineCode_disp0_s = firstSibling?.vaccineCode?.coding?.[0]?.display ?? "";
  const vaccineCode_code1_s = firstSibling?.vaccineCode?.coding?.[1]?.code ?? "";
  const vaccineCode_disp1_s = firstSibling?.vaccineCode?.coding?.[1]?.display ?? "";
  const vaccineCode_text_s = firstSibling?.vaccineCode?.text ?? "";
  const patientRef_s = firstSibling?.patient?.reference ?? "";
  const encounterRef_s = firstSibling?.encounter?.reference ?? "";
  const occurDateTime_s = firstSibling?.occurrenceDateTime ?? "";
  const locatRef_s = firstSibling?.location?.reference ?? "";
  const manufRef_s = firstSibling?.manufacturer?.reference ?? "";
  const lotNumber_s = firstSibling?.lotNumber ?? "";
  const site_code0_s = firstSibling?.site?.coding?.[0]?.code ?? "";
  const site_disp0_s = firstSibling?.site?.coding?.[0]?.display ?? "";
  const site_code1_s = firstSibling?.site?.coding?.[1]?.code ?? "";
  const site_disp1_s = firstSibling?.site?.coding?.[1]?.display ?? "";
  const site_text_s = firstSibling?.site?.text ?? "";
  const route_code0_s = firstSibling?.route?.coding?.[0]?.code ?? "";
  const route_disp0_s = firstSibling?.route?.coding?.[0]?.display ?? "";
  const route_code1_s = firstSibling?.route?.coding?.[1]?.code ?? "";
  const route_disp1_s = firstSibling?.route?.coding?.[1]?.display ?? "";
  const route_text_s = firstSibling?.route?.text ?? "";
  const doseQtty_val_s = firstSibling?.doseQuantity?.value ?? "";
  const doseQtty_unit_s = firstSibling?.doseQuantity?.unit ?? "";
  const performerRef_s = firstSibling?.performer?.[0]?.actor?.reference ?? "";
  const performerFunc_s = firstSibling?.performer?.[0]?.function?.coding?.[0]?.code ?? "";
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
  const react0_date_s = firstSibling?.reaction?.[0]?.date ?? "";
  const react0_detail_s = firstSibling?.reaction?.[0]?.detail?.reference ?? "";
  const react0_reported_s = firstSibling?.reaction?.[0]?.reported ?? "";
  const react1_date_s = firstSibling?.reaction?.[1]?.date ?? "";
  const react1_detail_s = firstSibling?.reaction?.[1]?.detail?.reference ?? "";
  const react1_reported_s = firstSibling?.reaction?.[1]?.reported ?? "";

  const notes = getNotes(resource, firstSibling);

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    vaccineCode_code0,
    vaccineCode_code0_s,
    vaccineCode_disp0,
    vaccineCode_disp0_s,
    vaccineCode_code1,
    vaccineCode_code1_s,
    vaccineCode_disp1,
    vaccineCode_disp1_s,
    vaccineCode_text,
    vaccineCode_text_s,
    patientRef,
    patientRef_s,
    encounterRef,
    encounterRef_s,
    occurDateTime,
    occurDateTime_s,
    locatRef,
    locatRef_s,
    manufRef,
    manufRef_s,
    lotNumber,
    lotNumber_s,
    site_code0,
    site_code0_s,
    site_disp0,
    site_disp0_s,
    site_code1,
    site_code1_s,
    site_disp1,
    site_disp1_s,
    site_text,
    site_text_s,
    route_code0,
    route_code0_s,
    route_disp0,
    route_disp0_s,
    route_code1,
    route_code1_s,
    route_disp1,
    route_disp1_s,
    route_text,
    route_text_s,
    doseQtty_val,
    doseQtty_val_s,
    doseQtty_unit,
    doseQtty_unit_s,
    performerRef,
    performerRef_s,
    performerFunc,
    performerFunc_s,
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
    react0_date,
    react0_date_s,
    react0_detail,
    react0_detail_s,
    react0_reported,
    react0_reported_s,
    react1_date,
    react1_date_s,
    react1_detail,
    react1_detail_s,
    react1_reported,
    react1_reported_s,

    ...notes,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
