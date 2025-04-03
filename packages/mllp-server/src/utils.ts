import { unpackUuid } from "@metriport/core/util/pack-uuid";
import { Base64Scrambler } from "@metriport/core/util/base64-scrambler";
import { Config } from "@metriport/core/util/config";

const crypto = new Base64Scrambler(Config.getBase64ScramblerSeed());

export const unpackPidField = (pid: string) => {
  const [cxString, patientString] = pid.split("_").map(s => crypto.unscramble(s));

  const cxId = unpackUuid(cxString);
  const patientId = unpackUuid(patientString);

  return { cxId, patientId };
};

export const constructS3Key = ({
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
