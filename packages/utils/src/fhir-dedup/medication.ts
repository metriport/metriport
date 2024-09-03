import { Medication, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, safeCsv } from "./csv";
import { isSibling } from "./shared";

const columns = [
  "id_o",
  "date",
  "code0_o",
  "code0_d",
  "code1_o",
  "code1_d",
  "text_o",
  "text_d",
  "id_d",
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

function medicationToCsv(medication: Medication, siblings: Medication[]): string {
  const sibling = siblings.find(isSibling(medication));
  const date = medication.meta?.lastUpdated
    ? new Date(medication.meta?.lastUpdated).toISOString()
    : "";
  const code0_o = medication.code?.coding?.[0]?.code ?? "";
  const code1_o = medication.code?.coding?.[1]?.code ?? "";
  const text_o = medication.code?.text ?? "";
  const code0_d = sibling?.code?.coding?.[0]?.code ?? "";
  const code1_d = sibling?.code?.coding?.[1]?.code ?? "";
  const text_d = sibling?.code?.text ?? "";
  const res: Record<Columns, string> = {
    id_o: medication.id ?? "",
    date,
    code0_o,
    code0_d,
    code1_o,
    code1_d,
    text_o,
    text_d,
    id_d: sibling?.id ?? "",
  };
  return Object.values(res).map(safeCsv).join(csvSeparator);
}
