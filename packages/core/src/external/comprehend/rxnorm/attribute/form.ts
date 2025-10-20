import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";
import { CodeableConcept } from "@medplum/fhirtypes";
import { getAttribute } from "../shared";
import { RxNormAttributeType } from "@aws-sdk/client-comprehendmedical";
import { getMedicationForm } from "../../../fhir/parser/medication-form";
import { SNOMED_URL } from "@metriport/shared/medical";

export function buildForm(entity: RxNormEntity): CodeableConcept | undefined {
  const form = getAttribute(entity, RxNormAttributeType.FORM);
  if (!form) return undefined;

  const display = form.Text;
  if (!display) return undefined;

  const code = getMedicationForm(display);
  if (!code) return undefined;

  return {
    coding: [{ system: SNOMED_URL, code, display }],
  };
}
