import { Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { errorToString } from "@metriport/shared";
import { buildDayjs, buildDayjsTz } from "@metriport/shared/common/date";
import { flow } from "lodash";
import { capture, out } from "../../util";
import { getOptionalValueFromMessage } from "../../command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { persistHl7Phi } from "../../command/hl7-notification/s3";

const MSH_DATETIME_OF_MESSAGE_INDEX = 7;
const EVN_RECORDED_DATETIME_INDEX = 2;
const EVN_DATETIME_PLANNED_EVENT_INDEX = 3;
const EVN_EVENT_OCCURRED_INDEX = 6;
const PV1_ADMIT_DATE_INDEX = 44;
const PV1_DISCHARGE_DATE_INDEX = 45;
const PID_DEATH_DATETIME_INDEX = 29;
const NK1_ROLE_START_DATE_INDEX = 8;
const NK1_ROLE_END_DATE_INDEX = 9;
const PV2_EXPECTED_ADMIT_DATE_INDEX = 8;
const PV2_EXPECTED_DISCHARGE_DATE_INDEX = 9;
const DG1_DIAGNOSIS_DATETIME_INDEX = 5;

export function utcifyHl7Message(message: Hl7Message, timezone: string): Hl7Message {
  /**
   * TODO: Properly timezoneify the message using getHieConfig, which requires making response format requests over email
   * Temporary to get NewYorkHie ADTs correct for now.
   **/
  function utcifyComponents(
    message: Hl7Message,
    segmentName: string,
    fieldIndex: number,
    componentIndex: number
  ) {
    return utcifyHl7Components(message, timezone, segmentName, fieldIndex, componentIndex);
  }

  return flow(
    message => utcifyComponents(message, "MSH", MSH_DATETIME_OF_MESSAGE_INDEX, 1),
    message => utcifyComponents(message, "EVN", EVN_RECORDED_DATETIME_INDEX, 1),
    message => utcifyComponents(message, "EVN", EVN_DATETIME_PLANNED_EVENT_INDEX, 1),
    message => utcifyComponents(message, "EVN", EVN_EVENT_OCCURRED_INDEX, 1),
    message => utcifyComponents(message, "PID", PID_DEATH_DATETIME_INDEX, 1),
    message => utcifyComponents(message, "PV1", PV1_ADMIT_DATE_INDEX, 1),
    message => utcifyComponents(message, "PV1", PV1_DISCHARGE_DATE_INDEX, 1),
    message => utcifyComponents(message, "PV2", PV2_EXPECTED_ADMIT_DATE_INDEX, 1),
    message => utcifyComponents(message, "PV2", PV2_EXPECTED_DISCHARGE_DATE_INDEX, 1),
    message => utcifyComponents(message, "DG1", DG1_DIAGNOSIS_DATETIME_INDEX, 1),
    message => utcifyComponents(message, "NK1", NK1_ROLE_START_DATE_INDEX, 1),
    message => utcifyComponents(message, "NK1", NK1_ROLE_END_DATE_INDEX, 1)
  )(message);
}

function utcifyHl7Components(
  message: Hl7Message,
  timezone: string,
  segmentName: string,
  fieldIndex: number,
  componentIndex: number
): Hl7Message {
  const { log } = out("utcifyHl7Components");
  const updatedSegments = message.segments.map(segment => {
    if (segment.name !== segmentName) return segment;

    let component = segment.getComponent(fieldIndex, componentIndex)?.trim();
    const isComponentEmpty = !component || component === "";
    if (isComponentEmpty) return segment;

    const tzOffset = handleTimezoneOffset(component, segmentName, fieldIndex);
    component = stripDecimals(tzOffset.component);

    let componentUtc;
    try {
      componentUtc = tzOffset.hadTzOffset
        ? component
        : buildDayjsTz(component, timezone).format("YYYYMMDDHHmmss");
    } catch (e) {
      const logMessage = `Full segment: ${segment.toString()}
      \nField @ ${fieldIndex} has value ${segment.getField(fieldIndex)?.toString()}
      \nField @ ${fieldIndex - 1} has value ${segment.getField(fieldIndex - 1)?.toString()}
      \nField @ ${fieldIndex + 1} has value ${segment.getField(fieldIndex + 1)?.toString()}
      \nFull message: ${message.segments.map(s => s.toString()).join("\n")}`;

      persistHl7Phi({
        patientId: getOptionalValueFromMessage(message, "PID", 3, 1) ?? "unknown-patient",
        stringMessage: logMessage,
        logger: out("utcifyHl7Components"),
      });

      const msg = `Error UTCifying component in segment ${segmentName}`;
      log(`${msg}, error - ${errorToString(e)}`);
      capture.error(msg, {
        extra: {
          segmentName,
          fieldIndex,
          componentIndex,
          component,
          error: errorToString(e),
          rawPatientIdentifier: getOptionalValueFromMessage(message, "PID", 3, 1),
        },
      });
      return segment;
    }

    const newFields = [...segment.fields];
    /**
     * @medplum/core indexes MSH differently than the other segments - it includes the MSH field as the first field.
     */
    const index = segmentName === "MSH" ? fieldIndex - 1 : fieldIndex;
    newFields[index] = new Hl7Field([[componentUtc]], segment.context);

    return new Hl7Segment(newFields, segment.context);
  });

  return new Hl7Message(updatedSegments, message.context);
}

/**
 * Adjusts HL7 datetime string to UTC if it has timezone offset (e.g., +04:00, +0400)
 * Returns the original string if no timezone offset is found.
 */
export function handleTimezoneOffset(
  component: string,
  segmentName: string,
  fieldIndex: number
): { hadTzOffset: boolean; component: string } {
  // Check for HH:mm format (e.g., +04:00, -05:00)
  const colonFormatMatch = component.match(/^([\d.]+)([+-]\d{2}:\d{2})$/);
  let adjustedComponent = component;
  if (colonFormatMatch && colonFormatMatch[1] && colonFormatMatch[2]) {
    const [, dateTimePart, offsetPart] = colonFormatMatch;
    adjustedComponent = adjustToUtc(dateTimePart, offsetPart, segmentName, fieldIndex);
  }

  // Check for HHmm format (e.g., +0400, -0500)
  const noColonFormatMatch = component.match(/^([\d.]+)([+-]\d{4})$/);
  if (noColonFormatMatch && noColonFormatMatch[1] && noColonFormatMatch[2]) {
    const [, dateTimePart, offsetPart] = noColonFormatMatch;
    adjustedComponent = adjustToUtc(dateTimePart, offsetPart, segmentName, fieldIndex);
  }

  return { hadTzOffset: !!colonFormatMatch || !!noColonFormatMatch, component: adjustedComponent };
}

function adjustToUtc(
  dateTimePart: string,
  offsetPart: string,
  segmentName: string,
  fieldIndex: number
): string {
  const { debug } = out("adjustToUtc");

  try {
    // Parse the offset to get hours and minutes
    const offsetMatch = offsetPart.match(/([+-])(\d{2}):?(\d{2})/);
    if (!offsetMatch || !offsetMatch[1] || !offsetMatch[2] || !offsetMatch[3]) return dateTimePart;

    const [, sign, hours, minutes] = offsetMatch;
    const hoursNum = parseInt(hours);
    const minutesNum = parseInt(minutes);

    let date = buildDayjs(dateTimePart);

    // If offset is positive (+), subtract to get UTC
    // If offset is negative (-), add to get UTC
    if (sign === "+") {
      date = date.subtract(hoursNum, "hour").subtract(minutesNum, "minute");
    } else {
      date = date.add(hoursNum, "hour").add(minutesNum, "minute");
    }

    return date.format("YYYYMMDDHHmmss");
  } catch (e) {
    const msg = `Error adjusting timezone offset in HL7 datetime field`;
    debug(`${msg}, error - ${errorToString(e)}`);
    capture.error(msg, {
      extra: { segmentName, fieldIndex, originalComponent: `${dateTimePart}${offsetPart}` },
    });
    return dateTimePart;
  }
}

/**
 * Strips decimals (e.g., .123) from HL7 datetime string
 *
 * This is done to simplify parsing, as there aren't consistently followed formats,
 * and the vast majority of the time no decimals are present.
 */
function stripDecimals(component: string): string {
  const decimalMatch = component.match(/^(\d{14})(\.\d+)$/);
  if (decimalMatch) {
    const [, dateTimePart] = decimalMatch;
    return dateTimePart ? dateTimePart : component;
  }
  return component;
}
