import { Annotation } from "@medplum/fhirtypes";
import { defaultIsDebug } from "./debug";
import { FIELD_SEPARATOR } from "./separator";

export function formatAnnotations({
  annotations,
  label,
  isDebug = defaultIsDebug,
}: {
  annotations: Annotation[] | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!annotations?.length) return undefined;
  const formattedAnnotations = annotations
    .map(annotation => formatAnnotation({ annotation, isDebug }))
    .filter(Boolean);
  if (formattedAnnotations.length < 1) return undefined;
  const formatted = formattedAnnotations.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}

export function formatAnnotation({
  annotation,
  label,
  isDebug = defaultIsDebug,
}: {
  annotation: Annotation | undefined;
  label?: string;
  isDebug?: boolean | undefined;
}): string | undefined {
  if (!annotation) return undefined;
  const { authorString, time, text } = annotation;
  const components = [
    authorString && isDebug ? `Author: ${authorString}` : authorString,
    time && isDebug ? `Time: ${time}` : time,
    text && isDebug ? `Text: ${text}` : text,
  ].filter(Boolean);
  if (components.length < 1) return undefined;
  const formatted = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formatted}` : formatted;
}
