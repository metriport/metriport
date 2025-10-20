import { Timing, TimingRepeat } from "@medplum/fhirtypes";
import { formatCodeableConcept } from "./codeable-concept";
import { defaultIsDebug } from "./debug";
import { formatDuration } from "./duration";
import { formatNumeric, formatNumericWithMax } from "./numeric";
import { formatPeriod } from "./period";
import { formatRange } from "./range";
import { FIELD_SEPARATOR } from "./separator";
import { formatStrings } from "./string";

export function formatTiming({
  timing,
  label,
  isDebug = defaultIsDebug,
}: {
  timing: Timing | undefined;
  label?: string;
  isDebug?: boolean;
}): string | undefined {
  if (!timing) return undefined;

  const { event, repeat, code } = timing;
  const eventsStr = event?.length ? event.join(FIELD_SEPARATOR) : undefined;
  const eventsWithLabel = eventsStr && isDebug ? `Events: ${eventsStr}` : eventsStr;
  const components = [
    eventsWithLabel,
    formatTimingRepeat({ repeat, isDebug, label: "Repeat" }),
    formatCodeableConcept({ concept: code, label: "Code", isDebug }),
  ].filter(Boolean);

  if (components.length < 1) return undefined;

  const formattedTiming = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedTiming}` : formattedTiming;
}

function formatTimingRepeat({
  repeat,
  label,
  isDebug = defaultIsDebug,
}: {
  repeat: TimingRepeat | undefined;
  label?: string;
  isDebug?: boolean;
}): string | undefined {
  if (!repeat) return undefined;
  const {
    boundsDuration,
    boundsRange,
    boundsPeriod,
    count,
    countMax,
    duration,
    durationMax,
    durationUnit,
    frequency,
    frequencyMax,
    period,
    periodMax,
    periodUnit,
    dayOfWeek,
    timeOfDay,
    when,
    offset,
  } = repeat;

  const components = [
    formatDuration({ duration: boundsDuration, label: "Bounds Duration", isDebug }),
    formatRange({ range: boundsRange, label: "Bounds Range", isDebug }),
    formatPeriod({ period: boundsPeriod, label: "Bounds Period", isDebug }),
    formatNumericWithMax({
      value: count,
      valueMax: countMax,
      label: "Count",
      isDebug,
    }),
    formatNumericWithMax({
      value: duration,
      valueMax: durationMax,
      unit: durationUnit,
      label: "Duration",
      isDebug,
    }),
    formatNumericWithMax({
      value: frequency,
      valueMax: frequencyMax,
      label: "Frequency",
      isDebug,
    }),
    formatNumericWithMax({
      value: period,
      valueMax: periodMax,
      unit: periodUnit,
      label: "Period",
      isDebug,
    }),
    formatStrings({
      values: dayOfWeek,
      label: "Days",
      isDebug,
    }),
    formatStrings({
      values: timeOfDay,
      label: "Times",
      isDebug,
    }),
    formatStrings({
      values: when,
      label: "When",
      isDebug,
    }),
    formatNumeric({ value: offset, unit: "minutes", label: "Offset", isDebug }),
  ].filter(s => s !== undefined && s.toString().trim().length > 0);

  if (components.length < 1) return undefined;

  const formattedRepeat = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedRepeat}` : formattedRepeat;
}
