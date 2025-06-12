import dayjs from "dayjs";
import { buildDayjsFromId } from "./id-generator";

export function makeRequestFileName(transmissionId: string): string {
  const transmissionDate = buildDayjsFromId(transmissionId);
  const localDate = transmissionDate.format("YYYYMMDD");

  return ["Metriport_PMA_", localDate, "-", transmissionId].join("");
}

export function makeResponseFileSuffix(transmissionId: string): string {
  const transmissionTimestamp = buildDayjsFromId(transmissionId).format("YYYYMMDDHHmmss");
  return ["_", transmissionTimestamp, ".gz"].join("");
}

export function parseVerificationFileName(remoteFileName: string):
  | {
      requestFileName: string;
      acceptedBySurescripts: Date;
    }
  | undefined {
  const [requestFileName, surescriptsUnixTimestamp, ...extensions] = remoteFileName.split(".");
  if (!requestFileName || !surescriptsUnixTimestamp?.match(/^\d+$/)) {
    return undefined;
  }

  const extension = extensions.join(".");
  if (extension !== "rsp" && extension !== "gz.rsp") {
    return undefined;
  }

  const acceptedBySurescripts = dayjs(parseInt(surescriptsUnixTimestamp)).toDate();
  return {
    requestFileName,
    acceptedBySurescripts,
  };
}
