import { Dosage, DosageDoseAndRate } from "@medplum/fhirtypes";
import { formatCodeableConcept, formatCodeableConcepts } from "./codeable-concept";
import { formatQuantity } from "./quantity";
import { FIELD_SEPARATOR } from "./separator";

export function formatDosages(dosages: Dosage[] | undefined, label: string): string | undefined {
  if (!dosages?.length) return undefined;
  const dosagesStr = dosages.map(dosage => formatDosage(dosage)).filter(Boolean);
  if (dosagesStr.length < 1) return undefined;
  const formattedDosages = dosagesStr.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formattedDosages}` : formattedDosages;
}

export function formatDosage(dosage: Dosage | undefined, label?: string): string | undefined {
  if (!dosage) return undefined;
  const components = [
    dosage.text && `Text: ${dosage.text}`,
    dosage.timing && `Timing: ${dosage.timing}`,
    dosage.route && formatCodeableConcepts([dosage.route], "Route"),
    dosage.method && formatCodeableConcepts([dosage.method], "Method"),
    dosage.doseAndRate &&
      dosage.doseAndRate.map(formatDosageDoseAndRate).filter(Boolean).join(FIELD_SEPARATOR),
  ].filter(Boolean);
  if (components.length < 1) return undefined;
  const formattedDosage = components.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formattedDosage}` : formattedDosage;
}

export function formatDosageDoseAndRate(dr: DosageDoseAndRate | undefined): string | undefined {
  if (!dr) return undefined;
  const drComponents = [
    formatCodeableConcept(dr.type, "Type"),
    dr.doseRange && `Dose Range: ${dr.doseRange}`,
    formatQuantity(dr.doseQuantity, "Dose"),
    dr.rateRatio && `Rate Ratio: ${dr.rateRatio}`,
    dr.rateRange && `Rate Range: ${dr.rateRange}`,
    formatQuantity(dr.rateQuantity, "Rate"),
  ].filter(Boolean);
  if (drComponents.length < 1) return undefined;
  const formattedDosage = drComponents.join(FIELD_SEPARATOR);
  return formattedDosage;
}
