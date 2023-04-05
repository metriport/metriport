import {
  CommonwellError,
  Document,
  DocumentContent,
  DocumentQueryResponse,
} from "@metriport/commonwell-sdk";
import mime from "mime-types";
import * as stream from "stream";
import { MedicalDataSource } from "..";
import { createOrUpdate } from "../../command/medical/document/create-or-update";
import { updateDocQueryStatus } from "../../command/medical/document/get-documents";
import {
  DocumentReference,
  DocumentReferenceCreate,
} from "../../domain/medical/document-reference";
import NotFoundError from "../../errors/not-found";
import { Patient } from "../../models/medical/patient";
import { capture } from "../../shared/notifications";
import { makePatientOID, oid } from "../../shared/oid";
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
  patient,
  facilityId,
}: {
  patient: Patient;
  facilityId: string;
}): Promise<DocumentReference[]> {
  try {
    const cwDocuments = await internalGetDocuments({ patient, facilityId });

    const documents = cwDocuments.map(toDomain(patient));

    return await createOrUpdate(patient, documents);
  } catch (err) {
    console.log(`Error: `, err);
    capture.error(err, {
      extra: {
        context: `cw.queryDocuments`,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    throw err;
  } finally {
    try {
      await updateDocQueryStatus({ patient, status: "completed" });
    } catch (err) {
      capture.error(err, {
        extra: { context: `cw.getDocuments.updateDocQueryStatus` },
      });
    }
  }
}

function toDomain(patient: Patient) {
  return (doc: DocumentWithLocation): DocumentReferenceCreate => {
    return {
      cxId: patient.cxId,
      patientId: patient.id,
      source: MedicalDataSource.COMMONWELL,
      externalId: doc.id,
      data: {
        fileName: doc.fileName,
        location: doc.location,
        description: doc.description,
        status: doc.status,
        indexed: doc.indexed,
        mimeType: doc.mimeType,
        size: doc.size,
        type: doc.type,
      },
    };
  };
}

async function internalGetDocuments({
  patient,
  facilityId,
}: {
  patient: Patient;
  facilityId: string;
}): Promise<DocumentWithLocation[]> {
  const { debug } = Util.out(`CW internalGetDocuments - M patient ${patient.id}`);

  const externalData = patient.data.externalData?.COMMONWELL;
  if (!externalData) return [];
  const cwData = externalData as PatientDataCommonwell;
  const { organization, facility } = await getPatientData(patient, facilityId);

  const orgName = organization.data.name;
  const orgId = organization.id;
  const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
  const commonWell = makeCommonWellAPI(orgName, oid(orgId));
  const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

  let docs: DocumentQueryResponse;
  try {
    docs = await commonWell.queryDocuments(queryMeta, cwData.patientId);
    debug(`resp queryDocuments: ${JSON.stringify(docs, null, 2)}`);
  } catch (err) {
    capture.error(err, {
      extra: {
        context: `cw.queryDocuments`,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    throw err;
  }

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

  try {
    await commonWell.retrieveDocument(queryMeta, location, stream);
  } catch (err) {
    capture.error(err, {
      extra: {
        context: `cw.retrieveDocument`,
        ...(err instanceof CommonwellError ? err.additionalInfo : undefined),
      },
    });
    if (err instanceof CommonwellError && err.cause?.response?.status === 404) {
      throw new NotFoundError("Document not found");
    }
    throw err;
  }
}

function getFileName(patient: Patient, doc: Document): string {
  const prefix = "document_" + makePatientOID("", patient.patientNumber).substring(1);
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
