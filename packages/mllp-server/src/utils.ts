import { unpackUuid } from "@metriport/core/util/pack-uuid";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

function reformUuid(shortId: string) {
  return unpackUuid(crypto.unscramble(shortId));
}

export function unpackPidField(pid: string | undefined) {
  if (!pid) {
    return { cxId: "UNK", patientId: "UNK" };
  }

  const [cxId, patientId] = pid.split("_").map(reformUuid);
  return { cxId, patientId };
}

export function buildS3Key({
  cxId,
  patientId,
  timestamp,
  messageType,
  messageCode,
}: {
  cxId: string;
  patientId: string;
  timestamp: string;
  messageType: string;
  messageCode: string;
}) {
  return `${cxId}/${patientId}/${timestamp}_${messageType}_${messageCode}.hl7`;
}
