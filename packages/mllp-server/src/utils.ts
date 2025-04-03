import { unpackUuid } from "@metriport/core/util/pack-uuid";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";

const crypto = new Base64Scrambler(Config.getHl7Base64ScramblerSeed());

const reformUuid = (shortId: string) => {
  return unpackUuid(crypto.unscramble(shortId));
};

export const unpackPidField = (pid: string) => {
  const [cxId, patientId] = pid.split("_").map(reformUuid);
  return { cxId, patientId };
};

export const buildS3Key = ({
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
}) => {
  return `${cxId}/${patientId}/${timestamp}_${messageType}_${messageCode}.hl7`;
};
