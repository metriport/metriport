import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Name } from "./outbound/xca/process/schema";
import { Slot, TextOrTextObject } from "./schema";

dayjs.extend(utc);

export function timestampToSoapBody(createdTimestamp: string, format = "YYYYMMDDHHmmss"): string {
  return buildDayjs(createdTimestamp).format(format);
}

export function extractText(textOrTextObject: TextOrTextObject): string {
  if (textOrTextObject && typeof textOrTextObject === "object") {
    return String(textOrTextObject._text);
  }
  return String(textOrTextObject);
}

export function getSlotValue(slot: Slot | undefined): string | undefined {
  if (!slot) {
    return undefined;
  }
  if (typeof slot.ValueList === "object" && slot.ValueList !== undefined) {
    const value = slot.ValueList.Value;

    if (!value) return undefined;
    if (Array.isArray(value)) {
      return String(value[0]);
    }
    return String(value);
  }
  return undefined;
}

export function getNameValue(name: Name | undefined): string | undefined {
  const localizedString = name?.LocalizedString;
  return typeof localizedString === "object" ? localizedString?._value : localizedString;
}

/**
 * Returns the queryByParameter XML element from the raw XML string.
 * This preserves the exact original XML (attribute order, whitespace, namespace prefixes)
 * as required by IHE ITI TF-2b for audit logging.
 */
export function getQueryByParameterFromIti55RequestXml(rawXml: string): string {
  const startTagPattern = /<[^>]*queryByParameter[^>]*>/i;
  const match = rawXml.match(startTagPattern);
  if (!match || match.index === undefined) {
    throw new MetriportError("Could not find queryByParameter start tag in XML");
  }
  const startIndex = match.index;

  const endTagPattern = /<\/[^>]*queryByParameter>/i;
  const endMatch = rawXml.match(endTagPattern);
  if (!endMatch || endMatch.index === undefined) {
    throw new MetriportError("Could not find queryByParameter end tag in XML");
  }
  const endIndex = endMatch.index + endMatch[0].length;

  return rawXml.substring(startIndex, endIndex);
}

/**
 * Returns the AdhocQueryRequest XML element from the raw XML string.
 * This preserves the exact original XML (attribute order, whitespace, namespace prefixes)
 * as required by IHE ITI TF-2b for audit logging.
 *
 * Used for ITI-38 inbound/responder audit events.
 */
export function getAdhocQueryRequestFromIti38RequestXml(rawXml: string): string {
  const startTagPattern = /<[^>]*AdhocQueryRequest[^>]*>/i;
  const match = rawXml.match(startTagPattern);
  if (!match || match.index === undefined) {
    throw new MetriportError("Could not find AdhocQueryRequest start tag in XML");
  }
  const startIndex = match.index;

  const endTagPattern = /<\/[^>]*AdhocQueryRequest>/i;
  const endMatch = rawXml.match(endTagPattern);
  if (!endMatch || endMatch.index === undefined) {
    throw new MetriportError("Could not find AdhocQueryRequest end tag in XML");
  }
  const endIndex = endMatch.index + endMatch[0].length;

  return rawXml.substring(startIndex, endIndex);
}
