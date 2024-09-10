import { Coverage, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/organization.html if you want to add them
const columns = [
  "id",
  "updatedAt",
  "links",
  "beneficiaryRef",
  "beneficiaryRef_s",
  "relatshp_code0",
  "relatshp_code0_s",
  "relatshp_disp0",
  "relatshp_disp0_s",
  "relatshp_code1",
  "relatshp_code1_s",
  "relatshp_disp1",
  "relatshp_disp1_s",
  "relatshp_text",
  "relatshp_text_s",
  "period_start",
  "period_start_s",
  "period_end",
  "period_end_s",
  "payorRef0",
  "payorRef0_s",
  "payorRef1",
  "payorRef1_s",
  "payorRef2",
  "payorRef2_s",
  "class0_type_code0",
  "class0_type_code0_s",
  "class0_type_disp0",
  "class0_type_disp0_s",
  "class0_type_code1",
  "class0_type_code1_s",
  "class0_type_disp1",
  "class0_type_disp1_s",
  "class0_type_text",
  "class0_type_text_s",
  "class0_value",
  "class0_value_s",
  "class0_name",
  "class0_name_s",
  "class1_type_code0",
  "class1_type_code0_s",
  "class1_type_disp0",
  "class1_type_disp0_s",
  "class1_type_code1",
  "class1_type_code1_s",
  "class1_type_disp1",
  "class1_type_disp1_s",
  "class1_type_text",
  "class1_type_text_s",
  "class1_value",
  "class1_value_s",
  "class1_name",
  "class1_name_s",
  "order",
  "order_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processCoverage(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Coverage[] = (originalDic.Coverage ?? []).flatMap(r => (r as Coverage) ?? []);
  const dedup: Coverage[] = (dedupDic.Coverage ?? []).flatMap(r => (r as Coverage) ?? []);

  const originalFileName = patientDirName + `/Coverage-original.csv`;
  const dedupFileName = patientDirName + `/Coverage-dedup.csv`;

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

function sort(a: Coverage, b: Coverage): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Coverage, others: Coverage[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const beneficiaryRef = resource.beneficiary?.reference ?? "";
  const relatshp_code0 = resource.relationship?.coding?.[0]?.code ?? "";
  const relatshp_disp0 = resource.relationship?.coding?.[0]?.display ?? "";
  const relatshp_code1 = resource.relationship?.coding?.[1]?.code ?? "";
  const relatshp_disp1 = resource.relationship?.coding?.[1]?.display ?? "";
  const relatshp_text = resource.relationship?.text ?? "";
  const period_start = resource.period?.start ?? "";
  const period_end = resource.period?.end ?? "";
  const payorRef0 = resource.payor?.[0]?.reference ?? "";
  const payorRef1 = resource.payor?.[1]?.reference ?? "";
  const payorRef2 = resource.payor?.[2]?.reference ?? "";
  const class0_type_code0 = resource.class?.[0]?.type?.coding?.[0]?.code ?? "";
  const class0_type_disp0 = resource.class?.[0]?.type?.coding?.[0]?.display ?? "";
  const class0_type_code1 = resource.class?.[0]?.type?.coding?.[1]?.code ?? "";
  const class0_type_disp1 = resource.class?.[0]?.type?.coding?.[1]?.display ?? "";
  const class0_type_text = resource.class?.[0]?.type?.text ?? "";
  const class0_value = resource.class?.[0]?.value ?? "";
  const class0_name = resource.class?.[0]?.name ?? "";
  const class1_type_code0 = resource.class?.[1]?.type?.coding?.[0]?.code ?? "";
  const class1_type_disp0 = resource.class?.[1]?.type?.coding?.[0]?.display ?? "";
  const class1_type_code1 = resource.class?.[1]?.type?.coding?.[1]?.code ?? "";
  const class1_type_disp1 = resource.class?.[1]?.type?.coding?.[1]?.display ?? "";
  const class1_type_text = resource.class?.[1]?.type?.text ?? "";
  const class1_value = resource.class?.[1]?.value ?? "";
  const class1_name = resource.class?.[1]?.name ?? "";
  const order = resource.order ?? "";

  const beneficiaryRef_s = firstSibling?.beneficiary?.reference ?? "";
  const relatshp_code0_s = firstSibling?.relationship?.coding?.[0]?.code ?? "";
  const relatshp_disp0_s = firstSibling?.relationship?.coding?.[0]?.display ?? "";
  const relatshp_code1_s = firstSibling?.relationship?.coding?.[1]?.code ?? "";
  const relatshp_disp1_s = firstSibling?.relationship?.coding?.[1]?.display ?? "";
  const relatshp_text_s = firstSibling?.relationship?.text ?? "";
  const period_start_s = firstSibling?.period?.start ?? "";
  const period_end_s = firstSibling?.period?.end ?? "";
  const payorRef0_s = firstSibling?.payor?.[0]?.reference ?? "";
  const payorRef1_s = firstSibling?.payor?.[1]?.reference ?? "";
  const payorRef2_s = firstSibling?.payor?.[2]?.reference ?? "";
  const class0_type_code0_s = firstSibling?.class?.[0]?.type?.coding?.[0]?.code ?? "";
  const class0_type_disp0_s = firstSibling?.class?.[0]?.type?.coding?.[0]?.display ?? "";
  const class0_type_code1_s = firstSibling?.class?.[0]?.type?.coding?.[1]?.code ?? "";
  const class0_type_disp1_s = firstSibling?.class?.[0]?.type?.coding?.[1]?.display ?? "";
  const class0_type_text_s = firstSibling?.class?.[0]?.type?.text ?? "";
  const class0_value_s = firstSibling?.class?.[0]?.value ?? "";
  const class0_name_s = firstSibling?.class?.[0]?.name ?? "";
  const class1_type_code0_s = firstSibling?.class?.[1]?.type?.coding?.[0]?.code ?? "";
  const class1_type_disp0_s = firstSibling?.class?.[1]?.type?.coding?.[0]?.display ?? "";
  const class1_type_code1_s = firstSibling?.class?.[1]?.type?.coding?.[1]?.code ?? "";
  const class1_type_disp1_s = firstSibling?.class?.[1]?.type?.coding?.[1]?.display ?? "";
  const class1_type_text_s = firstSibling?.class?.[1]?.type?.text ?? "";
  const class1_value_s = firstSibling?.class?.[1]?.value ?? "";
  const class1_name_s = firstSibling?.class?.[1]?.name ?? "";
  const order_s = firstSibling?.order ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    beneficiaryRef,
    beneficiaryRef_s,
    relatshp_code0,
    relatshp_code0_s,
    relatshp_disp0,
    relatshp_disp0_s,
    relatshp_code1,
    relatshp_code1_s,
    relatshp_disp1,
    relatshp_disp1_s,
    relatshp_text,
    relatshp_text_s,
    period_start,
    period_start_s,
    period_end,
    period_end_s,
    payorRef0,
    payorRef0_s,
    payorRef1,
    payorRef1_s,
    payorRef2,
    payorRef2_s,
    class0_type_code0,
    class0_type_code0_s,
    class0_type_disp0,
    class0_type_disp0_s,
    class0_type_code1,
    class0_type_code1_s,
    class0_type_disp1,
    class0_type_disp1_s,
    class0_type_text,
    class0_type_text_s,
    class0_value,
    class0_value_s,
    class0_name,
    class0_name_s,
    class1_type_code0,
    class1_type_code0_s,
    class1_type_disp0,
    class1_type_disp0_s,
    class1_type_code1,
    class1_type_code1_s,
    class1_type_disp1,
    class1_type_disp1_s,
    class1_type_text,
    class1_type_text_s,
    class1_value,
    class1_value_s,
    class1_name,
    class1_name_s,
    order,
    order_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
