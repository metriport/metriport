import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { OutboundDocumentQueryReq } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { getFacilityFromPatientOrFail } from "../../../command/medical/facility/get-facility";
import { CQLink } from "../cq-patient-data";
import { isCqOboFacility } from "../facility";
import { createPurposeOfUse } from "../shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export async function createOutboundDocumentQueryRequests({
  requestId,
  patient,
  cxId,
  organization,
  cqLinks,
}: {
  requestId: string;
  patient: Patient;
  cxId: string;
  organization: Organization;
  cqLinks: CQLink[];
}): Promise<OutboundDocumentQueryReq[]> {
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  const orgOid = organization.oid;
  const facility = await getFacilityFromPatientOrFail(patient); // TODO: replace with getHieInitiator
  // const facility = await getHieInitiator(patient);
  const isObo = isCqOboFacility(facility);

  return cqLinks.map(externalGateway => {
    return {
      id: requestId,
      cxId: cxId,
      timestamp: now,
      samlAttributes: {
        subjectId: user,
        subjectRole: {
          code: SUBJECT_ROLE_CODE,
          display: SUBJECT_ROLE_DISPLAY,
        },
        organization: isObo ? facility.data.name : orgName,
        organizationId: isObo ? facility.oid : orgOid,
        homeCommunityId: isObo ? facility.oid : orgOid,
        purposeOfUse: createPurposeOfUse(),
      },
      gateway: {
        homeCommunityId: externalGateway.oid,
        url: externalGateway.url,
      },
      externalGatewayPatient: {
        id: externalGateway.patientId,
        system: externalGateway.systemId,
      },
      patientId: patient.id,
    };
  });
}
