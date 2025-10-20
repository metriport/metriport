import { Practitioner, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/practitioner.html if you want to add them
const columns = [
  "id",
  "updatedAt",
  "links",
  "active",
  "active_s",
  "name0_family",
  "name0_family_s",
  "name0_given0",
  "name0_given0_s",
  "name0_given1",
  "name0_given1_s",
  "name0_prefix0",
  "name0_prefix0_s",
  "name0_prefix1",
  "name0_prefix1_s",
  "name0_suffix0",
  "name0_suffix0_s",
  "name0_suffix1",
  "name0_suffix1_s",
  "name0_text",
  "name0_text_s",
  "name0_use",
  "name0_use_s",
  "name0_period_start",
  "name0_period_start_s",
  "name0_period_end",
  "name0_period_end_s",
  "name1_family",
  "name1_family_s",
  "name1_given0",
  "name1_given0_s",
  "name1_given1",
  "name1_given1_s",
  "name1_prefix0",
  "name1_prefix0_s",
  "name1_prefix1",
  "name1_prefix1_s",
  "name1_suffix0",
  "name1_suffix0_s",
  "name1_suffix1",
  "name1_suffix1_s",
  "name1_text",
  "name1_text_s",
  "name1_use",
  "name1_use_s",
  "name1_period_start",
  "name1_period_start_s",
  "name1_period_end",
  "name1_period_end_s",
  "gender",
  "gender_s",
  "birthDate",
  "birthDate_s",
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
  "telco1_val",
  "telco1_val_s",
  "telco1_use",
  "telco1_use_s",
  "telco1_rank",
  "telco1_rank_s",
  "telco1_period_start",
  "telco1_period_start_s",
  "telco1_period_end",
  "telco1_period_end_s",
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
  "qualif0_id0_type_code0",
  "qualif0_id0_type_code0_s",
  "qualif0_id0_type_disp0",
  "qualif0_id0_type_disp0_s",
  "qualif0_id0_type_text",
  "qualif0_id0_type_text_s",
  "qualif0_id0_value",
  "qualif0_id0_value_s",
  "qualif0_code0",
  "qualif0_code0_s",
  "qualif0_disp0",
  "qualif0_disp0_s",
  "qualif0_code1",
  "qualif0_code1_s",
  "qualif0_disp1",
  "qualif0_disp1_s",
  "qualif0_code2",
  "qualif0_code2_s",
  "qualif0_disp2",
  "qualif0_disp2_s",
  "qualif0_text",
  "qualif0_text_s",
  "qualif0_period_start",
  "qualif0_period_start_s",
  "qualif0_period_end",
  "qualif0_period_end_s",
  "qualif0_issuerRef",
  "qualif0_issuerRef_s",
  "qualif1_id0_type_code0",
  "qualif1_id0_type_code0_s",
  "qualif1_id0_type_disp0",
  "qualif1_id0_type_disp0_s",
  "qualif1_id0_type_text",
  "qualif1_id0_type_text_s",
  "qualif1_id0_value",
  "qualif1_id0_value_s",
  "qualif1_code0",
  "qualif1_code0_s",
  "qualif1_disp0",
  "qualif1_disp0_s",
  "qualif1_code1",
  "qualif1_code1_s",
  "qualif1_disp1",
  "qualif1_disp1_s",
  "qualif1_code2",
  "qualif1_code2_s",
  "qualif1_disp2",
  "qualif1_disp2_s",
  "qualif1_text",
  "qualif1_text_s",
  "qualif1_period_start",
  "qualif1_period_start_s",
  "qualif1_period_end",
  "qualif1_period_end_s",
  "qualif1_issuerRef",
  "qualif1_issuerRef_s",
  "comms0_code0",
  "comms0_code0_s",
  "comms0_disp0",
  "comms0_disp0_s",
  "comms0_code1",
  "comms0_code1_s",
  "comms0_disp1",
  "comms0_disp1_s",
  "comms0_text",
  "comms0_text_s",
  "comms1_code0",
  "comms1_code0_s",
  "comms1_disp0",
  "comms1_disp0_s",
  "comms1_code1",
  "comms1_code1_s",
  "comms1_disp1",
  "comms1_disp1_s",
  "comms1_text",
  "comms1_text_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processPractitioner(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: Practitioner[] = (originalDic.Practitioner ?? []).flatMap(
    r => (r as Practitioner) ?? []
  );
  const dedup: Practitioner[] = (dedupDic.Practitioner ?? []).flatMap(
    r => (r as Practitioner) ?? []
  );

  const originalFileName = patientDirName + `/Practitioner-original.csv`;
  const dedupFileName = patientDirName + `/Practitioner-dedup.csv`;

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

function sort(a: Practitioner, b: Practitioner): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: Practitioner, others: Practitioner[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const active = resource.active ?? false;
  const name0_family = resource.name?.[0]?.family ?? "";
  const name0_given0 = resource.name?.[0]?.given?.[0] ?? "";
  const name0_given1 = resource.name?.[0]?.given?.[1] ?? "";
  const name0_prefix0 = resource.name?.[0]?.prefix?.[0] ?? "";
  const name0_prefix1 = resource.name?.[0]?.prefix?.[1] ?? "";
  const name0_suffix0 = resource.name?.[0]?.suffix?.[0] ?? "";
  const name0_suffix1 = resource.name?.[0]?.suffix?.[1] ?? "";
  const name0_text = resource.name?.[0]?.text ?? "";
  const name0_use = resource.name?.[0]?.use ?? "";
  const name0_period_start = resource.name?.[0]?.period?.start ?? "";
  const name0_period_end = resource.name?.[0]?.period?.end ?? "";
  const name1_family = resource.name?.[1]?.family ?? "";
  const name1_given0 = resource.name?.[1]?.given?.[0] ?? "";
  const name1_given1 = resource.name?.[1]?.given?.[1] ?? "";
  const name1_prefix0 = resource.name?.[1]?.prefix?.[0] ?? "";
  const name1_prefix1 = resource.name?.[1]?.prefix?.[1] ?? "";
  const name1_suffix0 = resource.name?.[1]?.suffix?.[0] ?? "";
  const name1_suffix1 = resource.name?.[1]?.suffix?.[1] ?? "";
  const name1_text = resource.name?.[1]?.text ?? "";
  const name1_use = resource.name?.[1]?.use ?? "";
  const name1_period_start = resource.name?.[1]?.period?.start ?? "";
  const name1_period_end = resource.name?.[1]?.period?.end ?? "";
  const gender = resource.gender ?? "";
  const birthDate = resource.birthDate ?? "";
  const telco0_val = resource.telecom?.[0]?.value ?? "";
  const telco0_use = resource.telecom?.[0]?.use ?? "";
  const telco0_rank = resource.telecom?.[0]?.rank ?? "";
  const telco0_period_start = resource.telecom?.[0]?.period?.start ?? "";
  const telco0_period_end = resource.telecom?.[0]?.period?.end ?? "";
  const telco1_val = resource.telecom?.[1]?.value ?? "";
  const telco1_use = resource.telecom?.[1]?.use ?? "";
  const telco1_rank = resource.telecom?.[1]?.rank ?? "";
  const telco1_period_start = resource.telecom?.[1]?.period?.start ?? "";
  const telco1_period_end = resource.telecom?.[1]?.period?.end ?? "";
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
  const qualif0_id0_type_code0 =
    resource.qualification?.[0]?.identifier?.[0]?.type?.coding?.[0]?.code ?? "";
  const qualif0_id0_type_disp0 =
    resource.qualification?.[0]?.identifier?.[0]?.type?.coding?.[0]?.display ?? "";
  const qualif0_id0_type_text = resource.qualification?.[0]?.identifier?.[0]?.type?.text ?? "";
  const qualif0_id0_value = resource.qualification?.[0]?.identifier?.[0]?.value ?? "";
  const qualif0_code0 = resource.qualification?.[0]?.code?.coding?.[0]?.code ?? "";
  const qualif0_disp0 = resource.qualification?.[0]?.code?.coding?.[0]?.display ?? "";
  const qualif0_code1 = resource.qualification?.[0]?.code?.coding?.[1]?.code ?? "";
  const qualif0_disp1 = resource.qualification?.[0]?.code?.coding?.[1]?.display ?? "";
  const qualif0_code2 = resource.qualification?.[0]?.code?.coding?.[2]?.code ?? "";
  const qualif0_disp2 = resource.qualification?.[0]?.code?.coding?.[2]?.display ?? "";
  const qualif0_text = resource.qualification?.[0]?.code?.text ?? "";
  const qualif0_period_start = resource.qualification?.[0]?.period?.start ?? "";
  const qualif0_period_end = resource.qualification?.[0]?.period?.end ?? "";
  const qualif0_issuerRef = resource.qualification?.[0]?.issuer?.reference ?? "";
  const qualif1_id0_type_code0 =
    resource.qualification?.[1]?.identifier?.[0]?.type?.coding?.[0]?.code ?? "";
  const qualif1_id0_type_disp0 =
    resource.qualification?.[1]?.identifier?.[0]?.type?.coding?.[0]?.display ?? "";
  const qualif1_id0_type_text = resource.qualification?.[1]?.identifier?.[0]?.type?.text ?? "";
  const qualif1_id0_value = resource.qualification?.[1]?.identifier?.[0]?.value ?? "";
  const qualif1_code0 = resource.qualification?.[1]?.code?.coding?.[0]?.code ?? "";
  const qualif1_disp0 = resource.qualification?.[1]?.code?.coding?.[0]?.display ?? "";
  const qualif1_code1 = resource.qualification?.[1]?.code?.coding?.[1]?.code ?? "";
  const qualif1_disp1 = resource.qualification?.[1]?.code?.coding?.[1]?.display ?? "";
  const qualif1_code2 = resource.qualification?.[1]?.code?.coding?.[2]?.code ?? "";
  const qualif1_disp2 = resource.qualification?.[1]?.code?.coding?.[2]?.display ?? "";
  const qualif1_text = resource.qualification?.[1]?.code?.text ?? "";
  const qualif1_period_start = resource.qualification?.[1]?.period?.start ?? "";
  const qualif1_period_end = resource.qualification?.[1]?.period?.end ?? "";
  const qualif1_issuerRef = resource.qualification?.[1]?.issuer?.reference ?? "";
  const comms0_code0 = resource.communication?.[0]?.coding?.[0]?.code ?? "";
  const comms0_disp0 = resource.communication?.[0]?.coding?.[0]?.display ?? "";
  const comms0_code1 = resource.communication?.[0]?.coding?.[1]?.code ?? "";
  const comms0_disp1 = resource.communication?.[0]?.coding?.[1]?.display ?? "";
  const comms0_text = resource.communication?.[0]?.text ?? "";
  const comms1_code0 = resource.communication?.[1]?.coding?.[0]?.code ?? "";
  const comms1_disp0 = resource.communication?.[1]?.coding?.[0]?.display ?? "";
  const comms1_code1 = resource.communication?.[1]?.coding?.[1]?.code ?? "";
  const comms1_disp1 = resource.communication?.[1]?.coding?.[1]?.display ?? "";
  const comms1_text = resource.communication?.[1]?.text ?? "";

  const active_s = firstSibling?.active ?? false;
  const name0_family_s = firstSibling?.name?.[0]?.family ?? "";
  const name0_given0_s = firstSibling?.name?.[0]?.given?.[0] ?? "";
  const name0_given1_s = firstSibling?.name?.[0]?.given?.[1] ?? "";
  const name0_prefix0_s = firstSibling?.name?.[0]?.prefix?.[0] ?? "";
  const name0_prefix1_s = firstSibling?.name?.[0]?.prefix?.[1] ?? "";
  const name0_suffix0_s = firstSibling?.name?.[0]?.suffix?.[0] ?? "";
  const name0_suffix1_s = firstSibling?.name?.[0]?.suffix?.[1] ?? "";
  const name0_text_s = firstSibling?.name?.[0]?.text ?? "";
  const name0_use_s = firstSibling?.name?.[0]?.use ?? "";
  const name0_period_start_s = firstSibling?.name?.[0]?.period?.start ?? "";
  const name0_period_end_s = firstSibling?.name?.[0]?.period?.end ?? "";
  const name1_family_s = firstSibling?.name?.[1]?.family ?? "";
  const name1_given0_s = firstSibling?.name?.[1]?.given?.[0] ?? "";
  const name1_given1_s = firstSibling?.name?.[1]?.given?.[1] ?? "";
  const name1_prefix0_s = firstSibling?.name?.[1]?.prefix?.[0] ?? "";
  const name1_prefix1_s = firstSibling?.name?.[1]?.prefix?.[1] ?? "";
  const name1_suffix0_s = firstSibling?.name?.[1]?.suffix?.[0] ?? "";
  const name1_suffix1_s = firstSibling?.name?.[1]?.suffix?.[1] ?? "";
  const name1_text_s = firstSibling?.name?.[1]?.text ?? "";
  const name1_use_s = firstSibling?.name?.[1]?.use ?? "";
  const name1_period_start_s = firstSibling?.name?.[1]?.period?.start ?? "";
  const name1_period_end_s = firstSibling?.name?.[1]?.period?.end ?? "";
  const gender_s = firstSibling?.gender ?? "";
  const birthDate_s = firstSibling?.birthDate ?? "";
  const telco0_val_s = firstSibling?.telecom?.[0]?.value ?? "";
  const telco0_use_s = firstSibling?.telecom?.[0]?.use ?? "";
  const telco0_rank_s = firstSibling?.telecom?.[0]?.rank ?? "";
  const telco0_period_start_s = firstSibling?.telecom?.[0]?.period?.start ?? "";
  const telco0_period_end_s = firstSibling?.telecom?.[0]?.period?.end ?? "";
  const telco1_val_s = firstSibling?.telecom?.[1]?.value ?? "";
  const telco1_use_s = firstSibling?.telecom?.[1]?.use ?? "";
  const telco1_rank_s = firstSibling?.telecom?.[1]?.rank ?? "";
  const telco1_period_start_s = firstSibling?.telecom?.[1]?.period?.start ?? "";
  const telco1_period_end_s = firstSibling?.telecom?.[1]?.period?.end ?? "";
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
  const qualif0_id0_type_code0_s =
    firstSibling?.qualification?.[0]?.identifier?.[0]?.type?.coding?.[0]?.code ?? "";
  const qualif0_id0_type_disp0_s =
    firstSibling?.qualification?.[0]?.identifier?.[0]?.type?.coding?.[0]?.display ?? "";
  const qualif0_id0_type_text_s =
    firstSibling?.qualification?.[0]?.identifier?.[0]?.type?.text ?? "";
  const qualif0_id0_value_s = firstSibling?.qualification?.[0]?.identifier?.[0]?.value ?? "";
  const qualif0_code0_s = firstSibling?.qualification?.[0]?.code?.coding?.[0]?.code ?? "";
  const qualif0_disp0_s = firstSibling?.qualification?.[0]?.code?.coding?.[0]?.display ?? "";
  const qualif0_code1_s = firstSibling?.qualification?.[0]?.code?.coding?.[1]?.code ?? "";
  const qualif0_disp1_s = firstSibling?.qualification?.[0]?.code?.coding?.[1]?.display ?? "";
  const qualif0_code2_s = firstSibling?.qualification?.[0]?.code?.coding?.[2]?.code ?? "";
  const qualif0_disp2_s = firstSibling?.qualification?.[0]?.code?.coding?.[2]?.display ?? "";
  const qualif0_text_s = firstSibling?.qualification?.[0]?.code?.text ?? "";
  const qualif0_period_start_s = firstSibling?.qualification?.[0]?.period?.start ?? "";
  const qualif0_period_end_s = firstSibling?.qualification?.[0]?.period?.end ?? "";
  const qualif0_issuerRef_s = firstSibling?.qualification?.[0]?.issuer?.reference ?? "";
  const qualif1_id0_type_code0_s =
    firstSibling?.qualification?.[1]?.identifier?.[0]?.type?.coding?.[0]?.code ?? "";
  const qualif1_id0_type_disp0_s =
    firstSibling?.qualification?.[1]?.identifier?.[0]?.type?.coding?.[0]?.display ?? "";
  const qualif1_id0_type_text_s =
    firstSibling?.qualification?.[1]?.identifier?.[0]?.type?.text ?? "";
  const qualif1_id0_value_s = firstSibling?.qualification?.[1]?.identifier?.[0]?.value ?? "";
  const qualif1_code0_s = firstSibling?.qualification?.[1]?.code?.coding?.[0]?.code ?? "";
  const qualif1_disp0_s = firstSibling?.qualification?.[1]?.code?.coding?.[0]?.display ?? "";
  const qualif1_code1_s = firstSibling?.qualification?.[1]?.code?.coding?.[1]?.code ?? "";
  const qualif1_disp1_s = firstSibling?.qualification?.[1]?.code?.coding?.[1]?.display ?? "";
  const qualif1_code2_s = firstSibling?.qualification?.[1]?.code?.coding?.[2]?.code ?? "";
  const qualif1_disp2_s = firstSibling?.qualification?.[1]?.code?.coding?.[2]?.display ?? "";
  const qualif1_text_s = firstSibling?.qualification?.[1]?.code?.text ?? "";
  const qualif1_period_start_s = firstSibling?.qualification?.[1]?.period?.start ?? "";
  const qualif1_period_end_s = firstSibling?.qualification?.[1]?.period?.end ?? "";
  const qualif1_issuerRef_s = firstSibling?.qualification?.[1]?.issuer?.reference ?? "";
  const comms0_code0_s = firstSibling?.communication?.[0]?.coding?.[0]?.code ?? "";
  const comms0_disp0_s = firstSibling?.communication?.[0]?.coding?.[0]?.display ?? "";
  const comms0_code1_s = firstSibling?.communication?.[0]?.coding?.[1]?.code ?? "";
  const comms0_disp1_s = firstSibling?.communication?.[0]?.coding?.[1]?.display ?? "";
  const comms0_text_s = firstSibling?.communication?.[0]?.text ?? "";
  const comms1_code0_s = firstSibling?.communication?.[1]?.coding?.[0]?.code ?? "";
  const comms1_disp0_s = firstSibling?.communication?.[1]?.coding?.[0]?.display ?? "";
  const comms1_code1_s = firstSibling?.communication?.[1]?.coding?.[1]?.code ?? "";
  const comms1_disp1_s = firstSibling?.communication?.[1]?.coding?.[1]?.display ?? "";
  const comms1_text_s = firstSibling?.communication?.[1]?.text ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    active,
    active_s,
    name0_family,
    name0_family_s,
    name0_given0,
    name0_given0_s,
    name0_given1,
    name0_given1_s,
    name0_prefix0,
    name0_prefix0_s,
    name0_prefix1,
    name0_prefix1_s,
    name0_suffix0,
    name0_suffix0_s,
    name0_suffix1,
    name0_suffix1_s,
    name0_text,
    name0_text_s,
    name0_use,
    name0_use_s,
    name0_period_start,
    name0_period_start_s,
    name0_period_end,
    name0_period_end_s,
    name1_family,
    name1_family_s,
    name1_given0,
    name1_given0_s,
    name1_given1,
    name1_given1_s,
    name1_prefix0,
    name1_prefix0_s,
    name1_prefix1,
    name1_prefix1_s,
    name1_suffix0,
    name1_suffix0_s,
    name1_suffix1,
    name1_suffix1_s,
    name1_text,
    name1_text_s,
    name1_use,
    name1_use_s,
    name1_period_start,
    name1_period_start_s,
    name1_period_end,
    name1_period_end_s,
    gender,
    gender_s,
    birthDate,
    birthDate_s,
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
    telco1_val,
    telco1_val_s,
    telco1_use,
    telco1_use_s,
    telco1_rank,
    telco1_rank_s,
    telco1_period_start,
    telco1_period_start_s,
    telco1_period_end,
    telco1_period_end_s,
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
    qualif0_id0_type_code0,
    qualif0_id0_type_code0_s,
    qualif0_id0_type_disp0,
    qualif0_id0_type_disp0_s,
    qualif0_id0_type_text,
    qualif0_id0_type_text_s,
    qualif0_id0_value,
    qualif0_id0_value_s,
    qualif0_code0,
    qualif0_code0_s,
    qualif0_disp0,
    qualif0_disp0_s,
    qualif0_code1,
    qualif0_code1_s,
    qualif0_disp1,
    qualif0_disp1_s,
    qualif0_code2,
    qualif0_code2_s,
    qualif0_disp2,
    qualif0_disp2_s,
    qualif0_text,
    qualif0_text_s,
    qualif0_period_start,
    qualif0_period_start_s,
    qualif0_period_end,
    qualif0_period_end_s,
    qualif0_issuerRef,
    qualif0_issuerRef_s,
    qualif1_id0_type_code0,
    qualif1_id0_type_code0_s,
    qualif1_id0_type_disp0,
    qualif1_id0_type_disp0_s,
    qualif1_id0_type_text,
    qualif1_id0_type_text_s,
    qualif1_id0_value,
    qualif1_id0_value_s,
    qualif1_code0,
    qualif1_code0_s,
    qualif1_disp0,
    qualif1_disp0_s,
    qualif1_code1,
    qualif1_code1_s,
    qualif1_disp1,
    qualif1_disp1_s,
    qualif1_code2,
    qualif1_code2_s,
    qualif1_disp2,
    qualif1_disp2_s,
    qualif1_text,
    qualif1_text_s,
    qualif1_period_start,
    qualif1_period_start_s,
    qualif1_period_end,
    qualif1_period_end_s,
    qualif1_issuerRef,
    qualif1_issuerRef_s,
    comms0_code0,
    comms0_code0_s,
    comms0_disp0,
    comms0_disp0_s,
    comms0_code1,
    comms0_code1_s,
    comms0_disp1,
    comms0_disp1_s,
    comms0_text,
    comms0_text_s,
    comms1_code0,
    comms1_code0_s,
    comms1_disp0,
    comms1_disp0_s,
    comms1_code1,
    comms1_code1_s,
    comms1_disp1,
    comms1_disp1_s,
    comms1_text,
    comms1_text_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
