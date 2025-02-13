import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { isOrganization, isPatient } from "@metriport/core/external/fhir/shared";
import { hasCommonwellContent } from "@metriport/core/external/commonwell/extension";
import { hasCarequalityContent } from "@metriport/core/external/carequality/extension";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";
import { DocumentReferenceWithId } from "@metriport/core/external/fhir/document/document-reference";

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
    const organization = document.contained?.find(contain => {
      if (isOrganization(contain)) {
        return contain.identifier?.find(identifier => identifier.value === oid);
      }
    });
    if (!organization) continue;

    const identifier = organization.identifier?.find(identifier => identifier.value === oid);
    if (identifier) {
      matchingDocumentRefs.push(document);
    }
  }

  return matchingDocumentRefs;
}
