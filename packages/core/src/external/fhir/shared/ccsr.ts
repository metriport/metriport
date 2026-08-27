import { CodeableConcept, Coding } from "@medplum/fhirtypes";
import { CONDITION_CCSR_CATEGORY_SYSTEM_URL } from "@metriport/shared/medical/fhir/constants";
import _ from "lodash";
import { out } from "../../../util";
import { getCcsrCategoryDescription, getCcsrCodeDescription } from "./ccsr-map";

type CcsrCoding = Coding & {
  system: typeof CONDITION_CCSR_CATEGORY_SYSTEM_URL;
  code: string;
};

export function buildCcsrCoding(ccsrCode: string): CcsrCoding {
  const display = getCcsrCodeDescription(ccsrCode);

  return {
    system: CONDITION_CCSR_CATEGORY_SYSTEM_URL,
    code: ccsrCode,
    ...(display ? { display } : undefined),
  };
}

export function findCcsrCoding(codings: Coding[]): CcsrCoding | undefined {
  return codings.find(isCcsrCoding);
}

export function isCcsrCoding(e: Coding): e is CcsrCoding {
  return e.system === CONDITION_CCSR_CATEGORY_SYSTEM_URL && !!e.code?.trim();
}

export function buildCcsrCategoriesFromCodes(codes: Coding[]): CodeableConcept[] | undefined {
  return _(codes)
    .filter(isCcsrCoding)
    .flatMap(coding => buildCcsrCategoryFromCode(coding.code) ?? [])
    .uniqBy(c => c.coding?.[0]?.code ?? "")
    .value();
}

export function buildCcsrCategoryFromCode(code: string): CodeableConcept | undefined {
  if (!code) return undefined;

  const categoryCode = code.toUpperCase().trim().substring(0, 3);
  const description = getCcsrCategoryDescription(categoryCode);
  if (!description) {
    const { log } = out("buildCcsrCategoryFromCode");
    const msg = `No CCSR category description found for code: ${code}`;
    log(msg, { extra: { code } });
    return undefined;
  }

  return {
    coding: [
      {
        system: CONDITION_CCSR_CATEGORY_SYSTEM_URL,
        code: categoryCode,
        display: description,
      },
    ],
    text: description,
  };
}
