import { PurposeOfUse } from "@metriport/shared";
import { DocumentRetrievalRequestOutgoing, DocumentReference } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { Organization } from "../../../domain/medical/organization";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createCQDocumentRetrievalRequests({
  requestId,
  cxId,
  organization,
  documentReferences,
}: {
  requestId: string;
  cxId: string;
  organization: Organization;
  documentReferences: DocumentReference[];
}): DocumentRetrievalRequestOutgoing[] {
  const orgOid = organization.oid;
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  return documentReferences.map(documentReference => {
    const { patientId, systemId, url } = documentReference;

    return {
      id: requestId,
      patientId: patientId,
      timestamp: now,
      samlAttributes: {
        subjectId: user,
        subjectRole: {
          code: SUBJECT_ROLE_CODE,
          display: SUBJECT_ROLE_DISPLAY,
        },
        organization: orgName,
        organizationId: orgOid,
        homeCommunityId: orgOid,
        purposeOfUse: PurposeOfUse.TREATMENT,
      },
      cxId: cxId,
      gateway: {
        homeCommunityId: systemId,
        url: url,
      },
      documentReference: [documentReference],
    };
  });
}
