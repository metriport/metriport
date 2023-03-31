import { AxiosInstance } from "axios";
import * as stream from "stream";
import { CommonwellError } from "../common/commonwell-error";
import { downloadFile } from "../common/fileDownload";
import { convertPatientIdToSubjectId } from "../common/util";
import { DocumentQueryResponse, documentQueryResponseSchema } from "../models/document";
import { buildQueryHeaders, CommonWell, RequestMetadata } from "./commonwell";

export async function query(
  api: AxiosInstance,
  meta: RequestMetadata,
  patientId: string
): Promise<DocumentQueryResponse> {
  const subjectId = convertPatientIdToSubjectId(patientId);
  if (!subjectId) {
    throw new Error(`Could not determine subject ID for document query`);
  }
  const headers = await buildQueryHeaders(meta);
  const url = `${CommonWell.DOCUMENT_QUERY_ENDPOINT}?subject.id=${subjectId}`;
  const additionalInfo = { meta, patientId };
  let response: any; //eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    response = await api.get(url, { headers });
  } catch (err) {
    throw new CommonwellError(`Error querying documents`, err, additionalInfo);
  }
  try {
    return documentQueryResponseSchema.parse(response.data);
  } catch (err) {
    throw new CommonwellError(`Error parsing document query response`, err, {
      ...additionalInfo,
      response,
    });
  }
}

export async function retrieve(
  api: AxiosInstance,
  meta: RequestMetadata,
  inputUrl: string,
  outputStream: stream.Writable
): Promise<void> {
  const headers = await buildQueryHeaders(meta);
  try {
    await downloadFile({
      url: inputUrl,
      outputStream,
      client: api,
      headers,
    });
  } catch (err) {
    throw new CommonwellError(`Error retrieve document`, err, {
      meta,
      inputUrl,
      outputStream: outputStream ? "[object]" : outputStream,
    });
  }
}
