import { Document, DocumentContent } from "@metriport/commonwell-sdk";
import mime from "mime-types";
import * as stream from "stream";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../models/medical/patient";
import { oid, patientId as makePatientId } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { getPatientData, PatientDataCommonwell } from "./patient-shared";

// TODO #340 When we fix tsconfig on CW SDK we can remove the `Required` for `id`
export type DocumentWithLocation = Required<Pick<Document, "id">> &
  Omit<DocumentContent, "location"> &
  Required<Pick<DocumentContent, "location">> & {
    fileName: string;
  };

export async function getDocuments({
  cxId,
  patientId,
  facilityId,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
}): Promise<DocumentWithLocation[]> {
  const { debug } = Util.out(`getDocuments - M patient ${patientId}`);

  const patient = await getPatientOrFail({ id: patientId, cxId });
  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return [];
  const cwData = externalData as PatientDataCommonwell;

  const { organization, facility } = await getPatientData(patient, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  const docs = await commonWell.queryDocuments(queryMeta, cwData.patientId);
  debug(`resp queryDocuments: ${JSON.stringify(docs, null, 2)}`);

  const documents: DocumentWithLocation[] = docs.entry
    ? docs.entry
        .flatMap(d =>
          d.id && d.content && d.content.location
            ? { id: d.id, content: { location: d.content.location, ...d.content } }
            : []
        )
        .map(d => ({
          id: d.id,
          fileName: getFileName(patient, d),
          description: d.content.description,
          type: d.content.type,
          status: d.content.status,
          location: d.content.location,
          indexed: d.content.indexed,
          mimeType: d.content.mimeType,
          size: d.content.size, // bytes
        }))
    : [];
  return documents;
}

export async function downloadDocument({
  cxId,
  patientId,
  facilityId,
  location,
  stream,
}: {
  cxId: string;
  patientId: string;
  facilityId: string;
  location: string;
  stream: stream.Writable;
}): Promise<void> {
  const { organization, facility } = await getPatientData({ id: patientId, cxId }, facilityId);
  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  await commonWell.retrieveDocument(queryMeta, location, stream);
}

function getFileName(patient: Patient, doc: Document): string {
  const prefix = "document_" + makePatientId("", patient.patientNumber).substring(1);
  const display = doc.content?.type?.coding?.length
    ? doc.content?.type.coding[0].display
    : undefined;
  const suffix = getSuffix(doc.id);
  const extension = getFileExtension(doc.content?.mimeType);
  const fileName = `${prefix}_${display ? display + "_" : display}${suffix}${extension}`;
  return fileName.replace(/\s/g, "-");
}

function getSuffix(id: string | undefined): string {
  if (!id) return "";
  return id.replace("urn:uuid:", "");
}

function getFileExtension(value: string | undefined): string {
  if (!value || !mime.contentType(value)) return "";
  const extension = mime.extension(value);
  return extension ? `.${extension}` : "";
}
