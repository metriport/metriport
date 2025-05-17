import { Annotation } from "@medplum/fhirtypes";
import { FIELD_SEPARATOR } from "./separator";

export function formatAnnotations(
  annotations: Annotation[] | undefined,
  label?: string
): string | undefined {
  if (!annotations?.length) return undefined;
  const formattedAnnotations = annotations.map(a => formatAnnotation(a));
  if (formattedAnnotations.length < 1) return undefined;
  const formatted = formattedAnnotations.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}

export function formatAnnotation(
  annotation: Annotation | undefined,
  label?: string
): string | undefined {
  if (!annotation) return undefined;
  const components = [
    annotation.authorString && `Author: ${annotation.authorString}`,
    annotation.time && `Time: ${annotation.time}`,
    annotation.text && `Text: ${annotation.text}`,
  ].filter(Boolean);
  if (components.length < 1) return undefined;
  const formatted = components.join(FIELD_SEPARATOR);
  return label ? `${label}: ${formatted}` : formatted;
}
