import { NetworkLink, isLOLA1 } from "@metriport/commonwell-sdk";

import { makeCommonWellAPI, metriportQueryMeta } from "../api";
import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { PatientDataCommonwell } from "../patient-shared";
import { setCommonwellId } from "../patient-external-data";
import { reset } from "../link";
import { createReferenceLink } from "./shared";

export const create = async (
  personId: string,
  patient: Patient,
  organization: Organization
): Promise<void> => {
  if (!patient.data.externalData?.COMMONWELL) {
    throw new Error("Patient has no external data");
  }

  const patientCWExternalData = patient.data.externalData.COMMONWELL as PatientDataCommonwell;
  const cwPatientId = patientCWExternalData.patientId;

  try {
    if (patientCWExternalData.personId) {
      await reset(patient, organization);

      await setCommonwellId({
        patientId: patient.id,
        cxId: patient.cxId,
        commonwellPatientId: cwPatientId,
        commonwellPersonId: undefined,
      });
    }

    const referenceLink = createReferenceLink(cwPatientId, organization.id);

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const link = await commonWell.patientLink(metriportQueryMeta, personId, referenceLink);

    if (!link._links?.self?.href) {
      throw new Error("Link has no href");
    }

    const networkLinks = await commonWell.getPatientsLinks(metriportQueryMeta, cwPatientId);

    if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
      const lola1Links = networkLinks._embedded.networkLink.filter(isLOLA1);

      const requests: Promise<NetworkLink>[] = [];

      lola1Links.forEach(async link => {
        if (link._links?.upgrade?.href) {
          requests.push(
            commonWell.upgradeOrDowngradeNetworkLink(metriportQueryMeta, link._links.upgrade.href)
          );
        }
      });

      const upgradeLinksResp = await Promise.allSettled(requests);

      const rejected = upgradeLinksResp.flatMap(r => (r.status === "rejected" ? r.reason : []));
      if (rejected.length > 0) {
        // TODO #369 also send ONE message to Slack?
        rejected.forEach(reason =>
          // TODO #156 SENTRY
          console.log(`Failed to upgrade link: ${reason}`)
        );
      }
    }

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: personId,
    });
  } catch (error) {
    const msg = `Failure linking`;
    console.log(`${msg} - person id:`, personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};
