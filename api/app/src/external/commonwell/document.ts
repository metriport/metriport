import { CommonwellError, DocumentQueryResponse } from "@metriport/commonwell-sdk";
import { createOrUpdate } from "../../command/medical/document/create-or-update";
import { updateDocQueryStatus } from "../../command/medical/document/get-documents";
import { DocumentReference } from "../../domain/medical/document-reference";
import { Patient } from "../../models/medical/patient";
import { capture } from "../../shared/notifications";
import { oid } from "../../shared/oid";
import { Util } from "../../shared/util";
import { makeCommonWellAPI, organizationQueryMeta } from "./api";
import { getPatientData, PatientDataCommonwell } from "./patient-shared";
import { DocumentWithLocation, getFileName, toDomain } from "./document/shared";

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
