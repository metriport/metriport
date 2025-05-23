import { Timing, TimingRepeat } from "@medplum/fhirtypes";
import { formatCodeableConcept } from "./codeable-concept";
import { defaultIsDebug } from "./debug";
import { formatDuration } from "./duration";
import { formatPeriod } from "./period";
import { formatRange } from "./range";
import { FIELD_SEPARATOR } from "./separator";

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
    count !== undefined
      ? countMax !== undefined
        ? isDebug
          ? `Count: ${count}-${countMax}`
          : `${count}-${countMax}`
        : isDebug
        ? `Count: ${count}`
        : count
      : undefined,
    duration !== undefined
      ? durationMax !== undefined
        ? isDebug
          ? `Duration: ${duration}-${durationMax} ${durationUnit}`
          : `${duration}-${durationMax} ${durationUnit}`
        : isDebug
        ? `Duration: ${duration} ${durationUnit}`
        : duration
      : undefined,
    frequency !== undefined
      ? frequencyMax !== undefined
        ? isDebug
          ? `Frequency: ${frequency}-${frequencyMax}`
          : `${frequency}-${frequencyMax}`
        : isDebug
        ? `Frequency: ${frequency}`
        : frequency
      : undefined,
    period !== undefined
      ? periodMax !== undefined
        ? isDebug
          ? `Period: ${period}-${periodMax} ${periodUnit}`
          : `${period}-${periodMax} ${periodUnit}`
        : isDebug
        ? `Period: ${period} ${periodUnit}`
        : period
      : undefined,
    dayOfWeek && isDebug
      ? `Days: ${dayOfWeek.join(FIELD_SEPARATOR)}`
      : dayOfWeek
      ? dayOfWeek.join(FIELD_SEPARATOR)
      : undefined,
    timeOfDay && isDebug
      ? `Times: ${timeOfDay.join(FIELD_SEPARATOR)}`
      : timeOfDay
      ? timeOfDay.join(FIELD_SEPARATOR)
      : undefined,
    when && isDebug
      ? `When: ${when.join(FIELD_SEPARATOR)}`
      : when
      ? when.join(FIELD_SEPARATOR)
      : undefined,
    offset !== undefined && isDebug ? `Offset: ${offset} minutes` : `${offset} minutes`,
  ].filter(s => s != undefined && s.toString().trim().length > 0);

  if (components.length < 1) return undefined;

  const formattedRepeat = components.join(FIELD_SEPARATOR);
  return isDebug && label ? `${label}: ${formattedRepeat}` : formattedRepeat;
}
