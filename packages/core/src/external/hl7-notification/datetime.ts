import { Hl7Field, Hl7Message, Hl7Segment } from "@medplum/core";
import { buildDayjsTz } from "@metriport/shared/common/date";
import { errorToString } from "@metriport/shared/dist/error/shared";
import { flow } from "lodash";
import { getSendingApplication } from "../../command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { capture, out } from "../../util";
import { getHieTimezone } from "./hie-timezone";

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

export function utcifyHl7Message(message: Hl7Message): Hl7Message {
  const sendingApplication = getSendingApplication(message);
  const hiePartner = sendingApplication ?? "Unknown HIE";
  capture.setExtra({ sendingApplication });

  /**
   * TODO: Properly timezoneify the message using getHieTimezone, which requires making response format requests over email
   * Temporary to get Hixny ADTs correct for now.
   * */
  const resolvedTimezone = hiePartner !== "HIXNY" ? getHieTimezone(hiePartner) : "America/New_York";

  function utcifyComponents(
    message: Hl7Message,
    segmentName: string,
    fieldIndex: number,
    componentIndex: number
  ) {
    return utcifyHl7Components(message, resolvedTimezone, segmentName, fieldIndex, componentIndex);
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

    component = stripTimezoneOffset(component, segmentName, fieldIndex);
    component = stripSubseconds(component);

    let componentUtc;
    try {
      componentUtc = buildDayjsTz(component, timezone).format("YYYYMMDDHHmmss");
    } catch (e) {
      const msg = `Error UTCifying component ${component} in segment ${segmentName}`;
      log(`${msg}, error - ${errorToString(e)}`);
      capture.error(msg, {
        extra: {
          segmentName,
          fieldIndex,
          componentIndex,
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
 * Strips timezone offset (e.g., +0400, -0500) from HL7 datetime string
 *
 * Doing this for now to simplify parsing, as there aren't consistently followed formats,
 * and the vast majority of the time no timezone offset is present.
 */
function stripTimezoneOffset(component: string, segmentName: string, fieldIndex: number): string {
  const { debug } = out("stripTimezoneOffset");
  const timezoneMatch = component.match(/^([\d.]+)([+-]\d{4})$/);
  if (timezoneMatch) {
    const [, dateTimePart, offsetPart] = timezoneMatch;
    if (dateTimePart && offsetPart) {
      const msg = `Dropped timezone offset ${offsetPart} in HL7 datetime field, stripping timezone`;
      debug(msg);
      capture.message(msg, {
        extra: { segmentName, fieldIndex, originalComponent: component, offset: offsetPart },
        level: "warning",
      });
      return dateTimePart;
    }
  }
  return component;
}

/**
 * Strips subsecond decimals (e.g., .123) from HL7 datetime string
 *
 * This is done to simplify parsing, as there aren't consistently followed formats,
 * and the vast majority of the time no subsecond decimals are present.
 */
function stripSubseconds(component: string): string {
  const { debug } = out("stripSubseconds");
  const subsecondMatch = component.match(/^(\d{14})(\.\d+)$/);
  if (subsecondMatch) {
    const [, dateTimePart] = subsecondMatch;
    if (dateTimePart) {
      const msg = `Dropped subsecond decimals in HL7 datetime field, stripping subseconds`;
      debug(msg);
      capture.message(msg, {
        extra: { originalComponent: component },
        level: "warning",
      });
      return dateTimePart;
    }
  }
  return component;
}
