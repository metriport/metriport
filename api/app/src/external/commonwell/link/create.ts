import { NetworkLink, isLOLA1 } from "@metriport/commonwell-sdk";
import { makeCommonWellAPI, metriportQueryMeta } from "../api";
import { oid } from "../../../shared/oid";
import { Patient } from "../../../models/medical/patient";
import { Organization } from "../../../models/medical/organization";
import { patientWithCWData } from "./shared";
import { setCommonwellId } from "../patient-external-data";
import { reset } from ".";

export const create = async (
  personId: string,
  patient: Patient,
  organization: Organization
): Promise<void> => {
  const externalData = patient.data.externalData;

  if (externalData === undefined || externalData.COMMONWELL === undefined) {
    throw new Error(`No external data for patient: ${patient.id}`);
  }

  const patientCWExternalData = patientWithCWData(patient, externalData.COMMONWELL);
  const cwPatientId = patientCWExternalData.data.externalData.COMMONWELL.patientId;
  const cwPersonId = patientCWExternalData.data.externalData.COMMONWELL.personId;

  try {
    if (cwPersonId === personId) {
      return;
    }

    if (cwPersonId) {
      await reset(patient, organization);
    }

    const orgName = organization.data.name;
    const orgId = organization.id;
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));

    const cwPatient = await commonWell.getPatient(metriportQueryMeta, cwPatientId);

    if (!cwPatient._links?.self?.href) {
      throw new Error(`No patient uri for cw patient: ${cwPatientId}`);
    }

    const link = await commonWell.addPatientLink(
      metriportQueryMeta,
      personId,
      cwPatient._links.self.href
    );

    await setCommonwellId({
      patientId: patient.id,
      cxId: patient.cxId,
      commonwellPatientId: cwPatientId,
      commonwellPersonId: personId,
    });

    if (!link._links?.self?.href) {
      throw new Error("Link has no href");
    }

    // TODO: Convert this into a function
    const networkLinks = await commonWell.getNetworkLinks(metriportQueryMeta, cwPatientId);

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
  } catch (error) {
    const msg = `Failure linking`;
    console.log(`${msg} - person id:`, personId);
    console.log(msg, error);
    throw new Error(msg);
  }
};
