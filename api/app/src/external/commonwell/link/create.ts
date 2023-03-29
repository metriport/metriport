import { isLOLA1, NetworkLink } from "@metriport/commonwell-sdk";
import * as Sentry from "@sentry/node";
import { reset } from ".";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { oid } from "../../../shared/oid";
import { makeCommonWellAPI, organizationQueryMeta } from "../api";
import { setCommonwellId } from "../patient-external-data";
import { getPatientData } from "../patient-shared";
import { patientWithCWData } from "./shared";

const context = "cw.link.create";

export const create = async (
  personId: string,
  patientId: string,
  cxId: string,
  facilityId: string
): Promise<void> => {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  const { organization, facility } = await getPatientData(patient, facilityId);

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
      await reset(patientId, cxId, facilityId);
    }

    const orgName = organization.data.name;
    const orgId = organization.id;
    const facilityNPI = facility.data["npi"] as string; // TODO #414 move to strong type - remove `as string`
    const commonWell = makeCommonWellAPI(orgName, oid(orgId));
    const queryMeta = organizationQueryMeta(orgName, { npi: facilityNPI });

    const cwPatient = await commonWell.getPatient(queryMeta, cwPatientId);

    if (!cwPatient._links?.self?.href) {
      throw new Error(`No patient uri for cw patient: ${cwPatientId}`);
    }

    const link = await commonWell.addPatientLink(queryMeta, personId, cwPatient._links.self.href);

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
    const networkLinks = await commonWell.getNetworkLinks(queryMeta, cwPatientId);

    if (networkLinks._embedded && networkLinks._embedded.networkLink?.length) {
      const lola1Links = networkLinks._embedded.networkLink.filter(isLOLA1);

      const requests: Promise<NetworkLink>[] = [];

      lola1Links.forEach(async link => {
        if (link._links?.upgrade?.href) {
          requests.push(
            commonWell
              .upgradeOrDowngradeNetworkLink(queryMeta, link._links.upgrade.href)
              .catch(err => {
                console.log(`Failed to upgrade link: `, err);
                Sentry.captureException(err, { extra: { cxId, cwPatientId, personId, context } });
                throw err;
              })
          );
        }
      });
      await Promise.allSettled(requests);
    }
  } catch (error) {
    Sentry.captureException(error, { extra: { cxId, cwPatientId, personId, context } });
    throw error;
  }
};
