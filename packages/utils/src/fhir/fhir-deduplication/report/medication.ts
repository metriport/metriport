import { Medication, Resource } from "@medplum/fhirtypes";
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
  "code0",
  "code0_s",
  "disp0",
  "disp0_s",
  "code1",
  "code1_s",
  "disp1",
  "disp1_s",
  "text",
  "text_s",
  "amount_num_val",
  "amount_num_val_s",
  "amount_num_unit",
  "amount_num_unit_s",
  "amount_denom_val",
  "amount_denom_val_s",
  "amount_denom_unit",
  "amount_denom_unit_s",
  "manufRef",
  "manufRef_s",
  "form_code0",
  "form_code0_s",
  "form_disp0",
  "form_disp0_s",
  "form_code1",
  "form_code1_s",
  "form_disp1",
  "form_disp1_s",
  "form_text",
  "form_text_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processMedication(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Medication[] = (originalDic.Medication ?? []).flatMap(
    r => (r as Medication) ?? []
  );
  const dedup: Medication[] = (dedupDic.Medication ?? []).flatMap(r => (r as Medication) ?? []);

  const originalFileName = patientDirName + `/Medication-original.csv`;
  const dedupFileName = patientDirName + `/Medication-dedup.csv`;

  const header = columns.join(csvSeparator);
  fs.writeFileSync(originalFileName, header + "\n");
  fs.writeFileSync(dedupFileName, header + "\n");

  const originalCsv = original
    .sort(sortMedication)
    .map(m => medicationToCsv(m, dedup))
    .join("\n");
  const dedupCsv = dedup
    .sort(sortMedication)
    .map(m => medicationToCsv(m, original))
    .join("\n");

  fs.writeFileSync(originalFileName, originalCsv, { flag: "a+" });
  fs.writeFileSync(dedupFileName, dedupCsv, { flag: "a+" });
}

function sortMedication(a: Medication, b: Medication): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function medicationToCsv(resource: Medication, others: Medication[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const date = resource.meta?.lastUpdated ? new Date(resource.meta?.lastUpdated).toISOString() : "";
  const links = siblings.length;

  const status = resource.status ?? "";
  const code0 = resource.code?.coding?.[0]?.code ?? "";
  const disp0 = resource.code?.coding?.[0]?.display ?? "";
  const code1 = resource.code?.coding?.[1]?.code ?? "";
  const disp1 = resource.code?.coding?.[1]?.display ?? "";
  const text = resource.code?.text ?? "";
  const amount_num_val = resource.amount?.numerator?.value ?? "";
  const amount_num_unit = resource.amount?.numerator?.unit ?? "";
  const amount_denom_val = resource.amount?.denominator?.value ?? "";
  const amount_denom_unit = resource.amount?.denominator?.unit ?? "";
  const manufRef = resource.manufacturer?.reference ?? "";
  const form_code0 = resource.form?.coding?.[0]?.code ?? "";
  const form_disp0 = resource.form?.coding?.[0]?.display ?? "";
  const form_code1 = resource.form?.coding?.[1]?.code ?? "";
  const form_disp1 = resource.form?.coding?.[1]?.display ?? "";
  const form_text = resource.form?.text ?? "";

  const status_s = firstSibling?.status ?? "";
  const code0_s = firstSibling?.code?.coding?.[0]?.code ?? "";
  const disp0_s = firstSibling?.code?.coding?.[0]?.display ?? "";
  const code1_s = firstSibling?.code?.coding?.[1]?.code ?? "";
  const disp1_s = firstSibling?.code?.coding?.[1]?.display ?? "";
  const text_s = firstSibling?.code?.text ?? "";
  const amount_num_val_s = firstSibling?.amount?.numerator?.value ?? "";
  const amount_num_unit_s = firstSibling?.amount?.numerator?.unit ?? "";
  const amount_denom_val_s = firstSibling?.amount?.denominator?.value ?? "";
  const amount_denom_unit_s = firstSibling?.amount?.denominator?.unit ?? "";
  const manufRef_s = firstSibling?.manufacturer?.reference ?? "";
  const form_code0_s = firstSibling?.form?.coding?.[0]?.code ?? "";
  const form_disp0_s = firstSibling?.form?.coding?.[0]?.display ?? "";
  const form_code1_s = firstSibling?.form?.coding?.[1]?.code ?? "";
  const form_disp1_s = firstSibling?.form?.coding?.[1]?.display ?? "";
  const form_text_s = firstSibling?.form?.text ?? "";

  const res: Record<Columns, string | number> = {
    id: resource.id ?? "",
    date,
    links,
    status,
    status_s,
    code0,
    code0_s,
    disp0,
    disp0_s,
    code1,
    code1_s,
    disp1,
    disp1_s,
    text,
    text_s,
    amount_num_val,
    amount_num_val_s,
    amount_num_unit,
    amount_num_unit_s,
    amount_denom_val,
    amount_denom_val_s,
    amount_denom_unit,
    amount_denom_unit_s,
    manufRef,
    manufRef_s,
    form_code0,
    form_code0_s,
    form_disp0,
    form_disp0_s,
    form_code1,
    form_code1_s,
    form_disp1,
    form_disp1_s,
    form_text,
    form_text_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
