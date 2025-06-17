import dayjs from "dayjs";
import { buildDayjs } from "@metriport/shared/common/date";
import { buildDayjsFromId } from "../id-generator";

const REQUEST_FILE_NAME_PREFIX = "Metriport_PMA_";

export function buildRequestFileName(transmissionId: string): string {
  const transmissionDate = buildDayjsFromId(transmissionId);
  const localDate = transmissionDate.format("YYYYMMDD");

  return [REQUEST_FILE_NAME_PREFIX, localDate, "-", transmissionId].join("");
}

export function buildResponseFileNamePrefix(transmissionId: string, populationId: string): string {
  return `${transmissionId}_${populationId}_`;
}

export function buildConversionBundleFileName(cxId: string, patientId: string): string {
  return `cxId=${cxId}/ptId=${patientId}/surescripts/latest.json`;
}

export function parseHistoryFileName(remoteFileName: string):
  | {
      requestFileName: string;
      senderId: string;
    }
  | undefined {
  const remoteFileMatch = remoteFileName.match(/^(\d+)_(\d+)_(.+)$/);
  if (!remoteFileMatch) return undefined;

  const [, dateString, timeString, requestFileNameWithSenderId] = remoteFileMatch;
  if (!dateString || !timeString || !requestFileNameWithSenderId) return undefined;

  const [requestFileName, senderId] = requestFileNameWithSenderId.split(".");
  if (!requestFileName || !senderId) return undefined;

  return {
    requestFileName,
    senderId,
  };
}

export function parseVerificationFileName(remoteFileName: string):
  | {
      requestFileName: string;
      createdAt: Date;
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

  const createdAt = dayjs(parseInt(surescriptsUnixTimestamp)).toDate();
  return {
    requestFileName,
    createdAt,
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
