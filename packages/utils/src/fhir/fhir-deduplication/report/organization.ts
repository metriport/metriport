import { Organization, Resource } from "@medplum/fhirtypes";
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
  "alias0",
  "alias0_s",
  "alias1",
  "alias1_s",
  "active",
  "active_s",
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
  "addr0_use",
  "addr0_use_s",
  "addr0_type",
  "addr0_type_s",
  "addr0_text",
  "addr0_text_s",
  "addr0_line0",
  "addr0_line0_s",
  "addr0_line1",
  "addr0_line1_s",
  "addr0_city",
  "addr0_city_s",
  "addr0_distct",
  "addr0_distct_s",
  "addr0_state",
  "addr0_state_s",
  "addr0_zip",
  "addr0_zip_s",
  "addr0_country",
  "addr0_country_s",
  "addr0_per_start",
  "addr0_per_start_s",
  "addr0_per_end",
  "addr0_per_end_s",
  "addr1_use",
  "addr1_use_s",
  "addr1_type",
  "addr1_type_s",
  "addr1_text",
  "addr1_text_s",
  "addr1_line0",
  "addr1_line0_s",
  "addr1_line1",
  "addr1_line1_s",
  "addr1_city",
  "addr1_city_s",
  "addr1_distct",
  "addr1_distct_s",
  "addr1_state",
  "addr1_state_s",
  "addr1_zip",
  "addr1_zip_s",
  "addr1_country",
  "addr1_country_s",
  "addr1_per_start",
  "addr1_per_start_s",
  "addr1_per_end",
  "addr1_per_end_s",
  "partOfRef",
  "partOfRef_s",
  "contact0_name",
  "contact0_name_s",
  "contact0_purpose",
  "contact0_purpose_s",
  "contact0_telco0_val",
  "contact0_telco0_val_s",
  "contact0_telco0_use",
  "contact0_telco0_use_s",
  "contact0_telco0_rank",
  "contact0_telco0_rank_s",
  "contact0_telco0_period_start",
  "contact0_telco0_period_start_s",
  "contact0_telco0_period_end",
  "contact0_telco0_period_end_s",
  "contact0_addr_use",
  "contact0_addr_use_s",
  "contact0_addr_type",
  "contact0_addr_type_s",
  "contact0_addr_text",
  "contact0_addr_text_s",
  "contact0_addr_line0",
  "contact0_addr_line0_s",
  "contact0_addr_line1",
  "contact0_addr_line1_s",
  "contact0_addr_city",
  "contact0_addr_city_s",
  "contact0_addr_distct",
  "contact0_addr_distct_s",
  "contact0_addr_state",
  "contact0_addr_state_s",
  "contact0_addr_zip",
  "contact0_addr_zip_s",
  "contact0_addr_country",
  "contact0_addr_country_s",
  "contact0_addr_per_start",
  "contact0_addr_per_start_s",
  "contact0_addr_per_end",
  "contact0_addr_per_end_s",
  "contact1_name",
  "contact1_name_s",
  "contact1_purpose",
  "contact1_purpose_s",
  "contact1_telco0_val",
  "contact1_telco0_val_s",
  "contact1_telco0_use",
  "contact1_telco0_use_s",
  "contact1_telco0_rank",
  "contact1_telco0_rank_s",
  "contact1_telco0_period_start",
  "contact1_telco0_period_start_s",
  "contact1_telco0_period_end",
  "contact1_telco0_period_end_s",
  "contact1_addr_use",
  "contact1_addr_use_s",
  "contact1_addr_type",
  "contact1_addr_type_s",
  "contact1_addr_text",
  "contact1_addr_text_s",
  "contact1_addr_line0",
  "contact1_addr_line0_s",
  "contact1_addr_line1",
  "contact1_addr_line1_s",
  "contact1_addr_city",
  "contact1_addr_city_s",
  "contact1_addr_distct",
  "contact1_addr_distct_s",
  "contact1_addr_state",
  "contact1_addr_state_s",
  "contact1_addr_zip",
  "contact1_addr_zip_s",
  "contact1_addr_country",
  "contact1_addr_country_s",
  "contact1_addr_per_start",
  "contact1_addr_per_start_s",
  "contact1_addr_per_end",
  "contact1_addr_per_end_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processOrganization(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Organization[] = (originalDic.Organization ?? []).flatMap(
    r => (r as Organization) ?? []
  );
  const dedup: Organization[] = (dedupDic.Organization ?? []).flatMap(
    r => (r as Organization) ?? []
  );

  const originalFileName = patientDirName + `/Organization-original.csv`;
  const dedupFileName = patientDirName + `/Organization-dedup.csv`;

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

function sort(a: Organization, b: Organization): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Organization, others: Organization[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const name = resource.name ?? "";
  const alias0 = resource.alias?.[0] ?? "";
  const alias1 = resource.alias?.[1] ?? "";
  const active = resource.active ?? "";
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
  const addr0_use = resource.address?.[0]?.use ?? "";
  const addr0_type = resource.address?.[0]?.type ?? "";
  const addr0_text = resource.address?.[0]?.text ?? "";
  const addr0_line0 = resource.address?.[0]?.line?.[0] ?? "";
  const addr0_line1 = resource.address?.[0]?.line?.[1] ?? "";
  const addr0_city = resource.address?.[0]?.city ?? "";
  const addr0_distct = resource.address?.[0]?.district ?? "";
  const addr0_state = resource.address?.[0]?.state ?? "";
  const addr0_zip = resource.address?.[0]?.postalCode ?? "";
  const addr0_country = resource.address?.[0]?.country ?? "";
  const addr0_per_start = resource.address?.[0]?.period?.start ?? "";
  const addr0_per_end = resource.address?.[0]?.period?.end ?? "";
  const addr1_use = resource.address?.[1]?.use ?? "";
  const addr1_type = resource.address?.[1]?.type ?? "";
  const addr1_text = resource.address?.[1]?.text ?? "";
  const addr1_line0 = resource.address?.[1]?.line?.[0] ?? "";
  const addr1_line1 = resource.address?.[1]?.line?.[1] ?? "";
  const addr1_city = resource.address?.[1]?.city ?? "";
  const addr1_distct = resource.address?.[1]?.district ?? "";
  const addr1_state = resource.address?.[1]?.state ?? "";
  const addr1_zip = resource.address?.[1]?.postalCode ?? "";
  const addr1_country = resource.address?.[1]?.country ?? "";
  const addr1_per_start = resource.address?.[1]?.period?.start ?? "";
  const addr1_per_end = resource.address?.[1]?.period?.end ?? "";
  const partOfRef = resource.partOf?.reference ?? "";
  const contact0_name = resource.contact?.[0]?.name?.text ?? "";
  const contact0_purpose = resource.contact?.[0]?.purpose?.text ?? "";
  const contact0_telco0_val = resource.contact?.[0]?.telecom?.[0]?.value ?? "";
  const contact0_telco0_use = resource.contact?.[0]?.telecom?.[0]?.use ?? "";
  const contact0_telco0_rank = resource.contact?.[0]?.telecom?.[0]?.rank ?? "";
  const contact0_telco0_period_start = resource.contact?.[0]?.telecom?.[0]?.period?.start ?? "";
  const contact0_telco0_period_end = resource.contact?.[0]?.telecom?.[0]?.period?.end ?? "";
  const contact0_addr_use = resource.contact?.[0]?.address?.use ?? "";
  const contact0_addr_type = resource.contact?.[0]?.address?.type ?? "";
  const contact0_addr_text = resource.contact?.[0]?.address?.text ?? "";
  const contact0_addr_line0 = resource.contact?.[0]?.address?.line?.[0] ?? "";
  const contact0_addr_line1 = resource.contact?.[0]?.address?.line?.[1] ?? "";
  const contact0_addr_city = resource.contact?.[0]?.address?.city ?? "";
  const contact0_addr_distct = resource.contact?.[0]?.address?.district ?? "";
  const contact0_addr_state = resource.contact?.[0]?.address?.state ?? "";
  const contact0_addr_zip = resource.contact?.[0]?.address?.postalCode ?? "";
  const contact0_addr_country = resource.contact?.[0]?.address?.country ?? "";
  const contact0_addr_per_start = resource.contact?.[0]?.address?.period?.start ?? "";
  const contact0_addr_per_end = resource.contact?.[0]?.address?.period?.end ?? "";
  const contact1_name = resource.contact?.[1]?.name?.text ?? "";
  const contact1_purpose = resource.contact?.[1]?.purpose?.text ?? "";
  const contact1_telco0_val = resource.contact?.[1]?.telecom?.[0]?.value ?? "";
  const contact1_telco0_use = resource.contact?.[1]?.telecom?.[0]?.use ?? "";
  const contact1_telco0_rank = resource.contact?.[1]?.telecom?.[0]?.rank ?? "";
  const contact1_telco0_period_start = resource.contact?.[1]?.telecom?.[0]?.period?.start ?? "";
  const contact1_telco0_period_end = resource.contact?.[1]?.telecom?.[0]?.period?.end ?? "";
  const contact1_addr_use = resource.contact?.[1]?.address?.use ?? "";
  const contact1_addr_type = resource.contact?.[1]?.address?.type ?? "";
  const contact1_addr_text = resource.contact?.[1]?.address?.text ?? "";
  const contact1_addr_line0 = resource.contact?.[1]?.address?.line?.[0] ?? "";
  const contact1_addr_line1 = resource.contact?.[1]?.address?.line?.[1] ?? "";
  const contact1_addr_city = resource.contact?.[1]?.address?.city ?? "";
  const contact1_addr_distct = resource.contact?.[1]?.address?.district ?? "";
  const contact1_addr_state = resource.contact?.[1]?.address?.state ?? "";
  const contact1_addr_zip = resource.contact?.[1]?.address?.postalCode ?? "";
  const contact1_addr_country = resource.contact?.[1]?.address?.country ?? "";
  const contact1_addr_per_start = resource.contact?.[1]?.address?.period?.start ?? "";
  const contact1_addr_per_end = resource.contact?.[1]?.address?.period?.end ?? "";

  const name_s = firstSibling?.name ?? "";
  const alias0_s = firstSibling?.alias?.[0] ?? "";
  const alias1_s = firstSibling?.alias?.[1] ?? "";
  const active_s = firstSibling?.active ?? "";
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
  const addr0_use_s = firstSibling?.address?.[0]?.use ?? "";
  const addr0_type_s = firstSibling?.address?.[0]?.type ?? "";
  const addr0_text_s = firstSibling?.address?.[0]?.text ?? "";
  const addr0_line0_s = firstSibling?.address?.[0]?.line?.[0] ?? "";
  const addr0_line1_s = firstSibling?.address?.[0]?.line?.[1] ?? "";
  const addr0_city_s = firstSibling?.address?.[0]?.city ?? "";
  const addr0_distct_s = firstSibling?.address?.[0]?.district ?? "";
  const addr0_state_s = firstSibling?.address?.[0]?.state ?? "";
  const addr0_zip_s = firstSibling?.address?.[0]?.postalCode ?? "";
  const addr0_country_s = firstSibling?.address?.[0]?.country ?? "";
  const addr0_per_start_s = firstSibling?.address?.[0]?.period?.start ?? "";
  const addr0_per_end_s = firstSibling?.address?.[0]?.period?.end ?? "";
  const addr1_use_s = firstSibling?.address?.[1]?.use ?? "";
  const addr1_type_s = firstSibling?.address?.[1]?.type ?? "";
  const addr1_text_s = firstSibling?.address?.[1]?.text ?? "";
  const addr1_line0_s = firstSibling?.address?.[1]?.line?.[0] ?? "";
  const addr1_line1_s = firstSibling?.address?.[1]?.line?.[1] ?? "";
  const addr1_city_s = firstSibling?.address?.[1]?.city ?? "";
  const addr1_distct_s = firstSibling?.address?.[1]?.district ?? "";
  const addr1_state_s = firstSibling?.address?.[1]?.state ?? "";
  const addr1_zip_s = firstSibling?.address?.[1]?.postalCode ?? "";
  const addr1_country_s = firstSibling?.address?.[1]?.country ?? "";
  const addr1_per_start_s = firstSibling?.address?.[1]?.period?.start ?? "";
  const addr1_per_end_s = firstSibling?.address?.[1]?.period?.end ?? "";
  const partOfRef_s = firstSibling?.partOf?.reference ?? "";
  const contact0_name_s = firstSibling?.contact?.[0]?.name?.text ?? "";
  const contact0_purpose_s = firstSibling?.contact?.[0]?.purpose?.text ?? "";
  const contact0_telco0_val_s = firstSibling?.contact?.[0]?.telecom?.[0]?.value ?? "";
  const contact0_telco0_use_s = firstSibling?.contact?.[0]?.telecom?.[0]?.use ?? "";
  const contact0_telco0_rank_s = firstSibling?.contact?.[0]?.telecom?.[0]?.rank ?? "";
  const contact0_telco0_period_start_s =
    firstSibling?.contact?.[0]?.telecom?.[0]?.period?.start ?? "";
  const contact0_telco0_period_end_s = firstSibling?.contact?.[0]?.telecom?.[0]?.period?.end ?? "";
  const contact0_addr_use_s = firstSibling?.contact?.[0]?.address?.use ?? "";
  const contact0_addr_type_s = firstSibling?.contact?.[0]?.address?.type ?? "";
  const contact0_addr_text_s = firstSibling?.contact?.[0]?.address?.text ?? "";
  const contact0_addr_line0_s = firstSibling?.contact?.[0]?.address?.line?.[0] ?? "";
  const contact0_addr_line1_s = firstSibling?.contact?.[0]?.address?.line?.[1] ?? "";
  const contact0_addr_city_s = firstSibling?.contact?.[0]?.address?.city ?? "";
  const contact0_addr_distct_s = firstSibling?.contact?.[0]?.address?.district ?? "";
  const contact0_addr_state_s = firstSibling?.contact?.[0]?.address?.state ?? "";
  const contact0_addr_zip_s = firstSibling?.contact?.[0]?.address?.postalCode ?? "";
  const contact0_addr_country_s = firstSibling?.contact?.[0]?.address?.country ?? "";
  const contact0_addr_per_start_s = firstSibling?.contact?.[0]?.address?.period?.start ?? "";
  const contact0_addr_per_end_s = firstSibling?.contact?.[0]?.address?.period?.end ?? "";
  const contact1_name_s = firstSibling?.contact?.[1]?.name?.text ?? "";
  const contact1_purpose_s = firstSibling?.contact?.[1]?.purpose?.text ?? "";
  const contact1_telco0_val_s = firstSibling?.contact?.[1]?.telecom?.[0]?.value ?? "";
  const contact1_telco0_use_s = firstSibling?.contact?.[1]?.telecom?.[0]?.use ?? "";
  const contact1_telco0_rank_s = firstSibling?.contact?.[1]?.telecom?.[0]?.rank ?? "";
  const contact1_telco0_period_start_s =
    firstSibling?.contact?.[1]?.telecom?.[0]?.period?.start ?? "";
  const contact1_telco0_period_end_s = firstSibling?.contact?.[1]?.telecom?.[0]?.period?.end ?? "";
  const contact1_addr_use_s = firstSibling?.contact?.[1]?.address?.use ?? "";
  const contact1_addr_type_s = firstSibling?.contact?.[1]?.address?.type ?? "";
  const contact1_addr_text_s = firstSibling?.contact?.[1]?.address?.text ?? "";
  const contact1_addr_line0_s = firstSibling?.contact?.[1]?.address?.line?.[0] ?? "";
  const contact1_addr_line1_s = firstSibling?.contact?.[1]?.address?.line?.[1] ?? "";
  const contact1_addr_city_s = firstSibling?.contact?.[1]?.address?.city ?? "";
  const contact1_addr_distct_s = firstSibling?.contact?.[1]?.address?.district ?? "";
  const contact1_addr_state_s = firstSibling?.contact?.[1]?.address?.state ?? "";
  const contact1_addr_zip_s = firstSibling?.contact?.[1]?.address?.postalCode ?? "";
  const contact1_addr_country_s = firstSibling?.contact?.[1]?.address?.country ?? "";
  const contact1_addr_per_start_s = firstSibling?.contact?.[1]?.address?.period?.start ?? "";
  const contact1_addr_per_end_s = firstSibling?.contact?.[1]?.address?.period?.end ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    name,
    name_s,
    alias0,
    alias0_s,
    alias1,
    alias1_s,
    active,
    active_s,
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
    addr0_use,
    addr0_use_s,
    addr0_type,
    addr0_type_s,
    addr0_text,
    addr0_text_s,
    addr0_line0,
    addr0_line0_s,
    addr0_line1,
    addr0_line1_s,
    addr0_city,
    addr0_city_s,
    addr0_distct,
    addr0_distct_s,
    addr0_state,
    addr0_state_s,
    addr0_zip,
    addr0_zip_s,
    addr0_country,
    addr0_country_s,
    addr0_per_start,
    addr0_per_start_s,
    addr0_per_end,
    addr0_per_end_s,
    addr1_use,
    addr1_use_s,
    addr1_type,
    addr1_type_s,
    addr1_text,
    addr1_text_s,
    addr1_line0,
    addr1_line0_s,
    addr1_line1,
    addr1_line1_s,
    addr1_city,
    addr1_city_s,
    addr1_distct,
    addr1_distct_s,
    addr1_state,
    addr1_state_s,
    addr1_zip,
    addr1_zip_s,
    addr1_country,
    addr1_country_s,
    addr1_per_start,
    addr1_per_start_s,
    addr1_per_end,
    addr1_per_end_s,
    partOfRef,
    partOfRef_s,
    contact0_name,
    contact0_name_s,
    contact0_purpose,
    contact0_purpose_s,
    contact0_telco0_val,
    contact0_telco0_val_s,
    contact0_telco0_use,
    contact0_telco0_use_s,
    contact0_telco0_rank,
    contact0_telco0_rank_s,
    contact0_telco0_period_start,
    contact0_telco0_period_start_s,
    contact0_telco0_period_end,
    contact0_telco0_period_end_s,
    contact0_addr_use,
    contact0_addr_use_s,
    contact0_addr_type,
    contact0_addr_type_s,
    contact0_addr_text,
    contact0_addr_text_s,
    contact0_addr_line0,
    contact0_addr_line0_s,
    contact0_addr_line1,
    contact0_addr_line1_s,
    contact0_addr_city,
    contact0_addr_city_s,
    contact0_addr_distct,
    contact0_addr_distct_s,
    contact0_addr_state,
    contact0_addr_state_s,
    contact0_addr_zip,
    contact0_addr_zip_s,
    contact0_addr_country,
    contact0_addr_country_s,
    contact0_addr_per_start,
    contact0_addr_per_start_s,
    contact0_addr_per_end,
    contact0_addr_per_end_s,
    contact1_name,
    contact1_name_s,
    contact1_purpose,
    contact1_purpose_s,
    contact1_telco0_val,
    contact1_telco0_val_s,
    contact1_telco0_use,
    contact1_telco0_use_s,
    contact1_telco0_rank,
    contact1_telco0_rank_s,
    contact1_telco0_period_start,
    contact1_telco0_period_start_s,
    contact1_telco0_period_end,
    contact1_telco0_period_end_s,
    contact1_addr_use,
    contact1_addr_use_s,
    contact1_addr_type,
    contact1_addr_type_s,
    contact1_addr_text,
    contact1_addr_text_s,
    contact1_addr_line0,
    contact1_addr_line0_s,
    contact1_addr_line1,
    contact1_addr_line1_s,
    contact1_addr_city,
    contact1_addr_city_s,
    contact1_addr_distct,
    contact1_addr_distct_s,
    contact1_addr_state,
    contact1_addr_state_s,
    contact1_addr_zip,
    contact1_addr_zip_s,
    contact1_addr_country,
    contact1_addr_country_s,
    contact1_addr_per_start,
    contact1_addr_per_start_s,
    contact1_addr_per_end,
    contact1_addr_per_end_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
