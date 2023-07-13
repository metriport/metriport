import { AxiosInstance } from "axios";
import * as stream from "stream";
import { CommonwellError } from "../common/commonwell-error";
import { downloadFile } from "../common/fileDownload";
import { convertPatientIdToSubjectId } from "../common/util";
import {
  DocumentQueryFullResponse,
  DocumentQueryResponse,
  documentQueryFullResponseSchema,
  documentQueryResponseSchema,
} from "../models/document";
import { CommonWell } from "./commonwell";

async function initQuery(
  api: AxiosInstance,
  headers: Record<string, string>,
  patientId: string
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const subjectId = convertPatientIdToSubjectId(patientId);
  if (!subjectId) {
    throw new Error(`Could not determine subject ID for document query`);
  }
  const url = `${CommonWell.DOCUMENT_QUERY_ENDPOINT}?subject.id=${subjectId}`;
  const additionalInfo = { headers, patientId };
  try {
    const response = await api.get(url, { headers });
    return response;
  } catch (err) {
    throw new CommonwellError(`Error querying documents`, err, additionalInfo);
  }
}

export async function query(
  api: AxiosInstance,
  headers: Record<string, string>,
  patientId: string
): Promise<DocumentQueryResponse> {
  const response = await initQuery(api, headers, patientId);
  try {
    return documentQueryResponseSchema.parse(response.data);
  } catch (err) {
    throw new CommonwellError(`Error parsing document query response`, err, {
      headers,
      patientId,
      response,
    });
  }
}

export async function queryFull(
  api: AxiosInstance,
  headers: Record<string, string>,
  patientId: string
): Promise<DocumentQueryFullResponse> {
  const response = await initQuery(api, headers, patientId);
  try {
    return documentQueryFullResponseSchema.parse(response.data);
  } catch (err) {
    throw new CommonwellError(`Error parsing document query response`, err, {
      headers,
      patientId,
      response,
    });
  }
}

export async function retrieve(
  api: AxiosInstance,
  headers: Record<string, string>,
  inputUrl: string,
  outputStream: stream.Writable
): Promise<void> {
  try {
    await downloadFile({
      url: inputUrl,
      outputStream,
      client: api,
      headers,
    });
  } catch (err) {
    throw new CommonwellError(`Error retrieve document`, err, {
      headers,
      inputUrl,
      outputStream: outputStream ? "[object]" : outputStream,
    });
  }
}
