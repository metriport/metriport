import { Location, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/organization.html if you want to add them
const columns = [
  "id",
  "updatedAt",
  "links",
  "name",
  "name_s",
  "desc",
  "desc_s",
  "mode",
  "mode_s",
  "type0_code0",
  "type0_code0_s",
  "type0_disp0",
  "type0_disp0_s",
  "type0_code1",
  "type0_code1_s",
  "type0_disp1",
  "type0_disp1_s",
  "type0_text",
  "type0_text_s",
  "type1_code0",
  "type1_code0_s",
  "type1_disp0",
  "type1_disp0_s",
  "type1_code1",
  "type1_code1_s",
  "type1_disp1",
  "type1_disp1_s",
  "type1_text",
  "type1_text_s",
  "telco0_val",
  "telco0_val_s",
  "telco0_use",
  "telco0_use_s",
  "telco0_rank",
  "telco0_rank_s",
  "telco0_period_start",
  "telco0_period_start_s",
  "telco0_period_end",
  "telco0_period_end_s",
  "addr_use",
  "addr_use_s",
  "addr_type",
  "addr_type_s",
  "addr_text",
  "addr_text_s",
  "addr_line0",
  "addr_line0_s",
  "addr_line1",
  "addr_line1_s",
  "addr_city",
  "addr_city_s",
  "addr_distct",
  "addr_distct_s",
  "addr_state",
  "addr_state_s",
  "addr_zip",
  "addr_zip_s",
  "addr_country",
  "addr_country_s",
  "addr_per_start",
  "addr_per_start_s",
  "addr_per_end",
  "addr_per_end_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processLocation(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Location[] = (originalDic.Location ?? []).flatMap(r => (r as Location) ?? []);
  const dedup: Location[] = (dedupDic.Location ?? []).flatMap(r => (r as Location) ?? []);

  const originalFileName = patientDirName + `/Location-original.csv`;
  const dedupFileName = patientDirName + `/Location-dedup.csv`;

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

function sort(a: Location, b: Location): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Location, others: Location[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const name = resource.name ?? "";
  const desc = resource.description ?? "";
  const mode = resource.mode ?? "";
  const type0_code0 = resource.type?.[0]?.coding?.[0]?.code ?? "";
  const type0_disp0 = resource.type?.[0]?.coding?.[0]?.display ?? "";
  const type0_code1 = resource.type?.[0]?.coding?.[1]?.code ?? "";
  const type0_disp1 = resource.type?.[0]?.coding?.[1]?.display ?? "";
  const type0_text = resource.type?.[0]?.text ?? "";
  const type1_code0 = resource.type?.[1]?.coding?.[0]?.code ?? "";
  const type1_disp0 = resource.type?.[1]?.coding?.[0]?.display ?? "";
  const type1_code1 = resource.type?.[1]?.coding?.[1]?.code ?? "";
  const type1_disp1 = resource.type?.[1]?.coding?.[1]?.display ?? "";
  const type1_text = resource.type?.[1]?.text ?? "";
  const telco0_val = resource.telecom?.[0]?.value ?? "";
  const telco0_use = resource.telecom?.[0]?.use ?? "";
  const telco0_rank = resource.telecom?.[0]?.rank ?? "";
  const telco0_period_start = resource.telecom?.[0]?.period?.start ?? "";
  const telco0_period_end = resource.telecom?.[0]?.period?.end ?? "";
  const addr_use = resource.address?.use ?? "";
  const addr_type = resource.address?.type ?? "";
  const addr_text = resource.address?.text ?? "";
  const addr_line0 = resource.address?.line?.[0] ?? "";
  const addr_line1 = resource.address?.line?.[1] ?? "";
  const addr_city = resource.address?.city ?? "";
  const addr_distct = resource.address?.district ?? "";
  const addr_state = resource.address?.state ?? "";
  const addr_zip = resource.address?.postalCode ?? "";
  const addr_country = resource.address?.country ?? "";
  const addr_per_start = resource.address?.period?.start ?? "";
  const addr_per_end = resource.address?.period?.end ?? "";

  const name_s = firstSibling?.name ?? "";
  const desc_s = firstSibling?.description ?? "";
  const mode_s = firstSibling?.mode ?? "";
  const type0_code0_s = firstSibling?.type?.[0]?.coding?.[0]?.code ?? "";
  const type0_disp0_s = firstSibling?.type?.[0]?.coding?.[0]?.display ?? "";
  const type0_code1_s = firstSibling?.type?.[0]?.coding?.[1]?.code ?? "";
  const type0_disp1_s = firstSibling?.type?.[0]?.coding?.[1]?.display ?? "";
  const type0_text_s = firstSibling?.type?.[0]?.text ?? "";
  const type1_code0_s = firstSibling?.type?.[1]?.coding?.[0]?.code ?? "";
  const type1_disp0_s = firstSibling?.type?.[1]?.coding?.[0]?.display ?? "";
  const type1_code1_s = firstSibling?.type?.[1]?.coding?.[1]?.code ?? "";
  const type1_disp1_s = firstSibling?.type?.[1]?.coding?.[1]?.display ?? "";
  const type1_text_s = firstSibling?.type?.[1]?.text ?? "";
  const telco0_val_s = firstSibling?.telecom?.[0]?.value ?? "";
  const telco0_use_s = firstSibling?.telecom?.[0]?.use ?? "";
  const telco0_rank_s = firstSibling?.telecom?.[0]?.rank ?? "";
  const telco0_period_start_s = firstSibling?.telecom?.[0]?.period?.start ?? "";
  const telco0_period_end_s = firstSibling?.telecom?.[0]?.period?.end ?? "";
  const addr_use_s = firstSibling?.address?.use ?? "";
  const addr_type_s = firstSibling?.address?.type ?? "";
  const addr_text_s = firstSibling?.address?.text ?? "";
  const addr_line0_s = firstSibling?.address?.line?.[0] ?? "";
  const addr_line1_s = firstSibling?.address?.line?.[1] ?? "";
  const addr_city_s = firstSibling?.address?.city ?? "";
  const addr_distct_s = firstSibling?.address?.district ?? "";
  const addr_state_s = firstSibling?.address?.state ?? "";
  const addr_zip_s = firstSibling?.address?.postalCode ?? "";
  const addr_country_s = firstSibling?.address?.country ?? "";
  const addr_per_start_s = firstSibling?.address?.period?.start ?? "";
  const addr_per_end_s = firstSibling?.address?.period?.end ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    name,
    name_s,
    desc,
    desc_s,
    mode,
    mode_s,
    type0_code0,
    type0_code0_s,
    type0_disp0,
    type0_disp0_s,
    type0_code1,
    type0_code1_s,
    type0_disp1,
    type0_disp1_s,
    type0_text,
    type0_text_s,
    type1_code0,
    type1_code0_s,
    type1_disp0,
    type1_disp0_s,
    type1_code1,
    type1_code1_s,
    type1_disp1,
    type1_disp1_s,
    type1_text,
    type1_text_s,
    telco0_val,
    telco0_val_s,
    telco0_use,
    telco0_use_s,
    telco0_rank,
    telco0_rank_s,
    telco0_period_start,
    telco0_period_start_s,
    telco0_period_end,
    telco0_period_end_s,
    addr_use,
    addr_use_s,
    addr_type,
    addr_type_s,
    addr_text,
    addr_text_s,
    addr_line0,
    addr_line0_s,
    addr_line1,
    addr_line1_s,
    addr_city,
    addr_city_s,
    addr_distct,
    addr_distct_s,
    addr_state,
    addr_state_s,
    addr_zip,
    addr_zip_s,
    addr_country,
    addr_country_s,
    addr_per_start,
    addr_per_start_s,
    addr_per_end,
    addr_per_end_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
