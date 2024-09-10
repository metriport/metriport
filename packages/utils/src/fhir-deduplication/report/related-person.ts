import { RelatedPerson, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import { Dictionary } from "lodash";
import { csvSeparator, normalizeForCsv } from "./csv";
import { isSibling } from "./shared";

// Lots of fields were not mapped, see https://www.hl7.org/fhir/R4/relatedperson.html if you want to add them
const columns = [
  "id",
  "updatedAt",
  "links",
  "patientRef",
  "patientRef_s",
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
  "dob",
  "dob_s",
  "relat0_code0",
  "relat0_code0_s",
  "relat0_disp0",
  "relat0_disp0_s",
  "relat0_code1",
  "relat0_code1_s",
  "relat0_disp1",
  "relat0_disp1_s",
  "relat0_text",
  "relat0_text_s",
  "relat1_code0",
  "relat1_code0_s",
  "relat1_disp0",
  "relat1_disp0_s",
  "relat1_code1",
  "relat1_code1_s",
  "relat1_disp1",
  "relat1_disp1_s",
  "relat1_text",
  "relat1_text_s",
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
  "period_start",
  "period_start_s",
  "period_end",
  "period_end_s",
  "ids_siblings",
] as const;
type Columns = (typeof columns)[number];

export async function processRelatedPerson(
  originalDic: Dictionary<Resource[]>,
  dedupDic: Dictionary<Resource[]>,
  patientDirName: string
): Promise<void> {
  const original: RelatedPerson[] = (originalDic.RelatedPerson ?? []).flatMap(
    r => (r as RelatedPerson) ?? []
  );
  const dedup: RelatedPerson[] = (dedupDic.RelatedPerson ?? []).flatMap(
    r => (r as RelatedPerson) ?? []
  );

  const originalFileName = patientDirName + `/RelatedPerson-original.csv`;
  const dedupFileName = patientDirName + `/RelatedPerson-dedup.csv`;

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

function sort(a: RelatedPerson, b: RelatedPerson): number {
  if (a.meta?.lastUpdated && b.meta?.lastUpdated) {
    return a.meta.lastUpdated.localeCompare(b.meta.lastUpdated);
  }
  if (a.meta?.lastUpdated) return 1;
  if (b.meta?.lastUpdated) return -1;
  return 0;
}

function toCsv(resource: RelatedPerson, others: RelatedPerson[]): string {
  const siblings = others.filter(isSibling(resource));
  const firstSibling = siblings[0];
  const updatedAt = resource.meta?.lastUpdated
    ? new Date(resource.meta?.lastUpdated).toISOString()
    : "";
  const links = siblings.length;

  const patientRef = resource.patient?.reference ?? "";
  const active = resource.active ?? "";
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
  const dob = resource.birthDate ?? "";
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
  const relat0_code0 = resource.relationship?.[0]?.coding?.[0]?.code ?? "";
  const relat0_disp0 = resource.relationship?.[0]?.coding?.[0]?.display ?? "";
  const relat0_code1 = resource.relationship?.[0]?.coding?.[1]?.code ?? "";
  const relat0_disp1 = resource.relationship?.[0]?.coding?.[1]?.display ?? "";
  const relat0_text = resource.relationship?.[0]?.text ?? "";
  const relat1_code0 = resource.relationship?.[1]?.coding?.[0]?.code ?? "";
  const relat1_disp0 = resource.relationship?.[1]?.coding?.[0]?.display ?? "";
  const relat1_code1 = resource.relationship?.[1]?.coding?.[1]?.code ?? "";
  const relat1_disp1 = resource.relationship?.[1]?.coding?.[1]?.display ?? "";
  const relat1_text = resource.relationship?.[1]?.text ?? "";
  const period_start = resource.period?.start ?? "";
  const period_end = resource.period?.end ?? "";

  const patientRef_s = firstSibling?.patient?.reference ?? "";
  const active_s = firstSibling?.active ?? "";
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
  const dob_s = firstSibling?.birthDate ?? "";
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
  const relat0_code0_s = firstSibling?.relationship?.[0]?.coding?.[0]?.code ?? "";
  const relat0_disp0_s = firstSibling?.relationship?.[0]?.coding?.[0]?.display ?? "";
  const relat0_code1_s = firstSibling?.relationship?.[0]?.coding?.[1]?.code ?? "";
  const relat0_disp1_s = firstSibling?.relationship?.[0]?.coding?.[1]?.display ?? "";
  const relat0_text_s = firstSibling?.relationship?.[0]?.text ?? "";
  const relat1_code0_s = firstSibling?.relationship?.[1]?.coding?.[0]?.code ?? "";
  const relat1_disp0_s = firstSibling?.relationship?.[1]?.coding?.[0]?.display ?? "";
  const relat1_code1_s = firstSibling?.relationship?.[1]?.coding?.[1]?.code ?? "";
  const relat1_disp1_s = firstSibling?.relationship?.[1]?.coding?.[1]?.display ?? "";
  const relat1_text_s = firstSibling?.relationship?.[1]?.text ?? "";
  const period_start_s = firstSibling?.period?.start ?? "";
  const period_end_s = firstSibling?.period?.end ?? "";

  const res: Record<Columns, string | number | boolean> = {
    id: resource.id ?? "",
    updatedAt,
    links,
    patientRef,
    patientRef_s,
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
    dob,
    dob_s,
    relat0_code0,
    relat0_code0_s,
    relat0_disp0,
    relat0_disp0_s,
    relat0_code1,
    relat0_code1_s,
    relat0_disp1,
    relat0_disp1_s,
    relat0_text,
    relat0_text_s,
    relat1_code0,
    relat1_code0_s,
    relat1_disp0,
    relat1_disp0_s,
    relat1_code1,
    relat1_code1_s,
    relat1_disp1,
    relat1_disp1_s,
    relat1_text,
    relat1_text_s,
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
    period_start,
    period_start_s,
    period_end,
    period_end_s,
    ids_siblings: siblings.map(s => s.id).join(","),
  };
  return Object.values(res).map(normalizeForCsv).join(csvSeparator);
}
