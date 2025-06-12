import dayjs from "dayjs";
import { buildDayjs } from "@metriport/shared/common/date";
import { buildDayjsFromId } from "./id-generator";

const REQUEST_FILE_NAME_PREFIX = "Metriport_PMA_";

export function makeRequestFileName(transmissionId: string): string {
  const transmissionDate = buildDayjsFromId(transmissionId);
  const localDate = transmissionDate.format("YYYYMMDD");

  return [REQUEST_FILE_NAME_PREFIX, localDate, "-", transmissionId].join("");
}

export function parseHistoryFileName(remoteFileName: string):
  | {
      requestFileName: string;
      senderId: string;
      createdAt: Date;
    }
  | undefined {
  const remoteFileMatch = remoteFileName.match(/^(\d+)_(\d+)_(.+)$/);
  if (!remoteFileMatch) return undefined;

  const [, dateString, timeString, requestFileNameWithSenderId] = remoteFileMatch;
  if (!dateString || !timeString || !requestFileNameWithSenderId) return undefined;
  const createdAt = buildDayjs(dateString + timeString, "YYMMDDHHmmss");
  if (!createdAt.isValid()) return undefined;

  const [requestFileName, senderId] = requestFileNameWithSenderId.split(".");
  if (!requestFileName || !senderId) return undefined;

  return {
    requestFileName,
    senderId,
    createdAt: createdAt.toDate(),
  };
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

export function parseResponseFileName(remoteFileName: string):
  | {
      transmissionId: string;
      populationId: string;
      externalFileId: string;
      responseDate: Date;
    }
  | undefined {
  const remoteFileNameMatch = remoteFileName.match(/^([-_a-zA-Z0-9]{10})_([^_]+)_(\d+)_(\d+)\.gz$/);
  if (!remoteFileNameMatch) return undefined;
  const [, transmissionId, populationId, externalFileId, responseDateString] = remoteFileNameMatch;
  if (!transmissionId || !populationId || !externalFileId || !responseDateString) return undefined;

  const responseDate = buildDayjs(responseDateString, "YYYYMMDDHHmmss");
  if (!responseDate.isValid()) return undefined;

  return {
    transmissionId,
    populationId,
    externalFileId,
    responseDate: responseDate.toDate(),
  };
}

export function makeResponseFileNamePrefix(transmissionId: string, populationId: string): string {
  return `${transmissionId}_${populationId}_`;
}
