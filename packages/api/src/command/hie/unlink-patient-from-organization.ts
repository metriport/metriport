import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";
import { isOrganization, isPatient } from "@metriport/core/external/fhir/shared";
import { hasCommonwellContent } from "@metriport/core/external/commonwell/extension";
import { hasCarequalityContent } from "@metriport/core/external/carequality/extension";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";
import { CQData } from "../../external/carequality/cq-patient-data";
import { CwData } from "../../external/commonwell/cw-patient-data";

type UnlinkPatientFromOrganizationParams = {
  cxId: string;
  patientId: string;
  oid: string;
};

export async function unlinkPatientFromOrganization({
  cxId,
  patientId,
  oid,
}: UnlinkPatientFromOrganizationParams): Promise<void> {
  const { log } = out(`unlinkPatientFromOrganization - M patient ${patientId}`);

  const cqPatientData = await getCQPatientData({ id: patientId, cxId });
  const cwPatientData = await getCwPatientData({ id: patientId, cxId });

  const documents = await getDocuments({ cxId, patientId });

  const documentsWithOid = getDocumentsWithOid(documents, oid);

  for (const document of documentsWithOid) {
    const fileName = getS3FileNameFromDocument(document);
    if (!fileName) continue;
  }
}

function findCwLinkWithOid(cwPatientData: CwData, oid: string): string | undefined {
  const cwLinks = cwPatientData.links;

  for (const cwLink of cwLinks) {
    const patient = cwLink.patient;
    if (!patient) continue;

    const identifier = patient.details.identifier?.find(
      identifier => identifier.assigner !== "Commonwell" && identifier.system === oid
    );

    if (identifier) {
      return cwLink;
    }
  }

  return undefined;
}

function getDocumentsWithOid(
  documents: DocumentReferenceWithId[],
  oid: string
): DocumentReferenceWithId[] {
  const urnOid = `urn:oid:${oid}`;
  const commonwellDocuments = documents.filter(hasCommonwellContent);
  const carequalityDocuments = documents.filter(hasCarequalityContent);

  const matchingDocumentRefs = [];

  for (const document of commonwellDocuments) {
    const patient = document.contained?.find(isPatient);
    if (!patient) continue;

    const identifier = patient.identifier?.find(identifier => identifier.system === urnOid);
    if (identifier) {
      matchingDocumentRefs.push(document);
    }
  }

  for (const document of carequalityDocuments) {
    const organization = document.contained?.find(isOrganization);
    if (!organization) continue;

    const identifier = organization.identifier?.find(identifier => identifier.value === oid);
    if (identifier) {
      matchingDocumentRefs.push(document);
    }
  }

  return matchingDocumentRefs;
}

function getS3FileNameFromDocument(document: DocumentReferenceWithId): string | undefined {
  const s3Attachment = document.content?.find(content => content.attachment?.url)?.attachment;
  const fileName = s3Attachment?.title;

  if (!fileName) {
    console.error(`No file name found in document ${document.id}`);
    return undefined;
  }

  return fileName;
}
