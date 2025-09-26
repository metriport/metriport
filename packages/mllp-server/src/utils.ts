import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Connection, Hl7ErrorEvent, Hl7MessageEvent } from "@medplum/hl7";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";
import { Logger } from "@metriport/core/util/log";
import { unpackUuid } from "@metriport/core/util/pack-uuid";

import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/node";
import { Hl7Message, Hl7Segment } from "@medplum/core";
import IPCIDR from "ip-cidr";
import { HieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import {
  fromBambooId,
  remapMessageReplacingPid3,
} from "@metriport/core/command/hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";

const CUSTOM_SEGMENT_NAME = "ZIT";
const CUSTOM_SEGMENT_HIE_NAME_INDEX = 1;
const CUSTOM_SEGMENT_TIMEZONE_INDEX = 2;

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());
export const s3Utils = new S3Utils(Config.getAWSRegion());
export const bucketName = Config.getHl7IncomingMessageBucketName();

export function withErrorHandling<T extends Hl7MessageEvent | Hl7ErrorEvent>(
  connection: Hl7Connection,
  logger: Logger,
  handler: (data: T) => void
): (data: T) => Promise<void> {
  return async (data: T) => {
    const isMessageEvent = data instanceof Hl7MessageEvent;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    await Sentry.withScope(async (_: Sentry.Scope) => {
      try {
        await handler(data);
      } catch (error) {
        if (isMessageEvent) {
          connection.send(data.message.buildAck());
        }

        logger.log(`Error in handler: ${error}`);
        Sentry.captureException(error);
      }
    });
  };
}

export function unpackPidField(pid: string | undefined) {
  if (!pid) {
    return { cxId: "UNK", patientId: "UNK" };
  }

  const [cxId, patientId] = pid.split("_").map(reformUuid);
  return { cxId, patientId };
}

function reformUuid(shortId: string) {
  return unpackUuid(crypto.unscramble(shortId));
}

const ipv4MappedIpv6Prefix = "::ffff:";

/**
 * Extract clean IP address from IPv4-mapped IPv6 address
 * Removes the ::ffff: prefix if present
 */
export function getCleanIpAddress(address: string | undefined): string {
  if (!address) {
    throw new MetriportError("IP address is undefined", undefined, {
      context: "mllp-server.getCleanIpAddress",
    });
  }

  // Trim to just the IPv4 address if possible
  if (address.startsWith(ipv4MappedIpv6Prefix)) {
    return address.substring(ipv4MappedIpv6Prefix.length);
  }

  return address;
}

/**
 * Avoid using message.toString() as its not stringifying every segment
 */
export function asString(message: Hl7Message) {
  return message.segments.map(s => s.toString()).join("\n");
}

export type HieVpnConfigRow = { hieName: string; cidrBlocks: string[]; timezone: string };

/**
 * Lookup the HIE config for a provided IP address.
 * @param hieConfigDictionary The HIE config dictionary.
 * @param ip The IP address to lookup.
 * @returns The HIE config for the given IP address.
 */
export function lookupHieTzEntryForIp(hieVpnConfigRows: HieVpnConfigRow[], ip: string) {
  const match = hieVpnConfigRows.find(({ cidrBlocks }) =>
    cidrBlocks.some(cidrBlock => isIpInRange(cidrBlock, ip))
  );
  if (!match) {
    console.log("[mllp-server.lookupHieTzEntryForIp] Sender IP not found in any CIDR block", ip);
    throw new MetriportError(`Sender IP not found in any CIDR block`, undefined, {
      context: "mllp-server.lookupHieTzEntryForIp",
      ip,
      hieVpnConfigRows: JSON.stringify(hieVpnConfigRows),
    });
  }
  return { hieName: match.hieName };
}

export function getHieConfig(
  hieConfigDictionary: HieConfigDictionary,
  ip: string,
  rawMessage: Hl7Message
): { hieName: string; timezone?: string } {
  const zitSegment = rawMessage.getSegment(CUSTOM_SEGMENT_NAME);
  const hieVpnConfigRows = Object.entries(hieConfigDictionary).flatMap(keepOnlyVpnConfigs);
  if (zitSegment) {
    const hieName = zitSegment.getField(CUSTOM_SEGMENT_HIE_NAME_INDEX).toString();
    if (!hieName) {
      throw new MetriportError("HIE name not found in ZIT segment", undefined, {
        context: "mllp-server.getHieConfig",
        zitSegment: zitSegment.toString(),
      });
    }
    const timezone = getTimezoneFromCustomSegment(zitSegment, hieName, hieVpnConfigRows);
    console.log(
      `[mllp-server.getHieConfig] Impersonating HIE: ${hieName} with timezone: ${timezone}`
    );
    return { hieName, timezone };
  }
  return lookupHieTzEntryForIp(hieVpnConfigRows, ip);
}

function getTimezoneFromCustomSegment(
  zitSegment: Hl7Segment,
  hieName: string,
  hieVpnConfigRows: HieVpnConfigRow[]
): string {
  const timezone = zitSegment.getField(CUSTOM_SEGMENT_TIMEZONE_INDEX).toString();
  if (!timezone) {
    const match = hieVpnConfigRows.find(({ hieName: configHieName }) => configHieName === hieName);
    if (!match) {
      throw new MetriportError(
        "Impersonation request failed. HIE not found in config dictionary",
        undefined,
        {
          context: "mllp-server.getHieConfig",
          zitSegment: zitSegment.toString(),
          hieVpnConfigRows: JSON.stringify(hieVpnConfigRows),
        }
      );
    }
    return match.timezone;
  }
  return timezone;
}

function isIpInRange(cidrBlock: string, ip: string): boolean {
  const cidr = new IPCIDR(cidrBlock);
  return cidr.contains(ip);
}

function keepOnlyVpnConfigs([hieName, config]: [string, HieConfigDictionary[string]]): {
  hieName: string;
  cidrBlocks: string[];
  timezone: string;
}[] {
  return "cidrBlocks" in config
    ? [{ hieName, cidrBlocks: config.cidrBlocks, timezone: config.timezone }]
    : [];
}

export function translateMessage(rawMessage: Hl7Message, hieName: string): Hl7Message {
  if (hieName === "Bamboo") {
    const pid = rawMessage.getSegment("PID");
    if (!pid) {
      throw new MetriportError("PID segment not found in bamboo message", undefined, { hieName });
    }
    const bambooId = pid.getComponent(3, 1);
    if (!bambooId) {
      throw new MetriportError("ID not found in bamboo message", undefined, { hieName });
    }
    const normalId = fromBambooId(bambooId);

    const newMessage = remapMessageReplacingPid3(rawMessage, normalId);
    return newMessage;
  }
  return rawMessage;
}
