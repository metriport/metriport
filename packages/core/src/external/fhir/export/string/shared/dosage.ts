import { Dosage, DosageDoseAndRate } from "@medplum/fhirtypes";
import { formatCodeableConcept } from "./codeable-concept";
import { defaultIsDebug } from "./debug";
import { formatQuantity } from "./quantity";
import { formatRange } from "./range";
import { FIELD_SEPARATOR } from "./separator";

export function formatDosages({
  dosages,
  label,
  isDebug = defaultIsDebug,
}: {
  dosages: Dosage[] | undefined;
  label: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!dosages?.length) return undefined;
  const dosagesStr = dosages.map(dosage => formatDosage({ dosage })).filter(Boolean);
  if (dosagesStr.length < 1) return undefined;
  const formattedDosages = dosagesStr.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedDosages}` : formattedDosages;
}

export function formatDosage({
  dosage,
  label,
  isDebug = defaultIsDebug,
}: {
  dosage: Dosage | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!dosage) return undefined;
  const { text, timing, route, method, doseAndRate } = dosage;
  const doseAndRateStr = doseAndRate
    ?.map(dosageAndRate => formatDosageDoseAndRate({ dosageAndRate, isDebug }))
    .filter(Boolean);
  const components = [
    text && isDebug ? `Text: ${text}` : text,
    formatCodeableConcept({ concept: timing, label: "Timing", isDebug }),
    formatCodeableConcept({ concept: route, label: "Route", isDebug }),
    formatCodeableConcept({ concept: method, label: "Method", isDebug }),
    doseAndRateStr && doseAndRateStr.join(FIELD_SEPARATOR),
  ].filter(Boolean);
  if (components.length < 1) return undefined;
  const formattedDosage = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedDosage}` : formattedDosage;
}

export function formatDosageDoseAndRate({
  dosageAndRate,
  isDebug = defaultIsDebug,
}: {
  dosageAndRate: DosageDoseAndRate | undefined;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!dosageAndRate) return undefined;
  const { type, doseRange, doseQuantity, rateRatio, rateRange, rateQuantity } = dosageAndRate;
  const drComponents = [
    formatCodeableConcept({ concept: type, label: "Type", isDebug }),
    formatRange({ range: doseRange, label: "Dose Range", isDebug }),
    formatQuantity({ quantity: doseQuantity, label: "Dose", isDebug }),
    formatRange({ range: rateRatio, label: "Rate Ratio", isDebug }),
    formatRange({ range: rateRange, label: "Rate Range", isDebug }),
    formatQuantity({ quantity: rateQuantity, label: "Rate", isDebug }),
  ].filter(Boolean);
  if (drComponents.length < 1) return undefined;
  const formattedDosage = drComponents.join(FIELD_SEPARATOR);
  return formattedDosage;
}
