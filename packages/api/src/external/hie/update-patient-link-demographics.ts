import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { PatientModel } from "../../models/medical/patient";
import { executeOnDBTx } from "../../models/transaction-wrapper";

/**
 * Stores the link demographics found.
 */
export async function updatePatientLinkDemographics({
  requestId,
  patient,
  source,
  links,
}: {
  requestId: string;
  patient: Pick<Patient, "id" | "cxId">;
  source: MedicalDataSource;
  links: LinkDemographics[];
}): Promise<Patient> {
  const { log } = out(`${source} PD - requestId ${requestId}, patient ${patient.id}`);

  log(`Updating patient link demographics`);

  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const externalData = existingPatient.data.externalData ?? {};
    const consolidatedLinkDemograhpics = existingPatient.data.consolidatedLinkDemograhpics;

    const updatedExternalData = {
      ...externalData,
      [source]: {
        ...externalData[source],
        linkDemograhpics: {
          ...(externalData[source]?.linkDemographics ?? {}),
          [requestId]: links,
        },
      },
    };

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.data,
        consolidatedLinkDemograhpics: {
          names: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.names ?? []),
              ...links.flatMap(ld => ld.names),
            ]),
          ],
          addressesObj: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.addressesObj ?? []),
              ...links.flatMap(ld => ld.addressesObj),
            ]),
          ],
          addressesString: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.addressesString ?? []),
              ...links.flatMap(ld => ld.addressesString),
            ]),
          ],
          telephoneNumbers: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.telephoneNumbers ?? []),
              ...links.flatMap(ld => ld.telephoneNumbers),
            ]),
          ],
          emails: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.emails ?? []),
              ...links.flatMap(ld => ld.emails),
            ]),
          ],
          driversLicenses: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.driversLicenses ?? []),
              ...links.flatMap(ld => ld.driversLicenses),
            ]),
          ],
          ssns: [
            ...new Set([
              ...(consolidatedLinkDemograhpics?.ssns ?? []),
              ...links.flatMap(ld => ld.ssns),
            ]),
          ],
        },
        externalData: updatedExternalData,
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
