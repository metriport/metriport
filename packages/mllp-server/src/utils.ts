import * as dotenv from "dotenv";
dotenv.config();

import { Hl7Message } from "@medplum/core";
import { Hl7Connection, Hl7ErrorEvent, Hl7MessageEvent } from "@medplum/hl7";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";
import { Logger } from "@metriport/core/util/log";
import { unpackUuid } from "@metriport/core/util/pack-uuid";
import IPCIDR from "ip-cidr";

import { HieConfigDictionary } from "@metriport/core/external/hl7-notification/hie-config-dictionary";
import { MetriportError } from "@metriport/shared";
import * as Sentry from "@sentry/node";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());
export const s3Utils = new S3Utils(Config.getAWSRegion());
export const bucketName = Config.getHl7IncomingMessageBucketName();

/**
 * Avoid using message.toString() as its not stringifying every segment
 */
export function asString(message: Hl7Message) {
  return message.segments.map(s => s.toString()).join("\n");
}

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

export function lookupHieTzEntryForIp(hieConfigDictionary: HieConfigDictionary, ip: string) {
  const cidrToTimezoneRows = Object.entries(hieConfigDictionary).map(
    ([hieName, { cidrBlock, timezone }]) => ({ hieName, cidrBlock, timezone })
  );
  const hieRow = cidrToTimezoneRows.find(({ cidrBlock }) => isIpInRange(cidrBlock, ip));
  if (!hieRow) {
    throw new MetriportError(`Sender IP not found in any CIDR block`, {
      cause: undefined,
      additionalInfo: { context: "mllp-server.lookupHieTzEntryForIp", ip, hieConfigDictionary },
    });
  }
  return hieRow;
}

export function isIpInRange(cidrBlock: string, ip: string): boolean {
  const cidr = new IPCIDR(cidrBlock);
  return cidr.contains(ip);
}
