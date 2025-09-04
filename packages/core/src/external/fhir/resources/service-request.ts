import { CodeableConcept } from "@medplum/fhirtypes";
import { SNOMED_URL } from "@metriport/shared/medical";

export const SERVICE_REQUEST_CATEGORY_NAMES = [
  "Laboratory procedure",
  "Imaging",
  "Counselling",
  "Education",
  "Surgical Procedure",
] as const;
export type ServiceRequestCategoryName = (typeof SERVICE_REQUEST_CATEGORY_NAMES)[number];

export const SERVICE_REQUEST_CATEGORY_SNOMED_CODE: Record<ServiceRequestCategoryName, string> = {
  "Laboratory procedure": "108252007",
  Imaging: "363679005",
  Counselling: "409063005",
  Education: "409073007",
  "Surgical Procedure": "387713003",
};

export function getServiceRequestCategory(
  categoryName: ServiceRequestCategoryName
): CodeableConcept {
  return {
    coding: [
      {
        system: SNOMED_URL,
        code: SERVICE_REQUEST_CATEGORY_SNOMED_CODE[categoryName],
        display: categoryName,
      },
    ],
  };
}
