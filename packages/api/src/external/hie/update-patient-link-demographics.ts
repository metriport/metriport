import { MedicalDataSource } from "@metriport/core/external/index";
import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { getPatientModelOrFail } from "../../command/medical/patient/get-patient";
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
    const existingPatient = await getPatientModelOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const consolidatedLinkDemographics =
      existingPatient.dataValues.data.consolidatedLinkDemographics;

    const updatedPatient = {
      ...existingPatient.dataValues,
      data: {
        ...existingPatient.dataValues.data,
        consolidatedLinkDemographics: {
          names: [
            ...new Set([
              ...(consolidatedLinkDemographics?.names ?? []),
              ...links.flatMap(ld => ld.names),
            ]),
          ].sort(),
          addresses: [
            ...new Set([
              ...(consolidatedLinkDemographics?.addresses ?? []),
              ...links.flatMap(ld => ld.addresses),
            ]),
          ].sort(),
          telephoneNumbers: [
            ...new Set([
              ...(consolidatedLinkDemographics?.telephoneNumbers ?? []),
              ...links.flatMap(ld => ld.telephoneNumbers),
            ]),
          ].sort(),
          emails: [
            ...new Set([
              ...(consolidatedLinkDemographics?.emails ?? []),
              ...links.flatMap(ld => ld.emails),
            ]),
          ].sort(),
          driversLicenses: [
            ...new Set([
              ...(consolidatedLinkDemographics?.driversLicenses ?? []),
              ...links.flatMap(ld => ld.driversLicenses),
            ]),
          ].sort(),
          ssns: [
            ...new Set([
              ...(consolidatedLinkDemographics?.ssns ?? []),
              ...links.flatMap(ld => ld.ssns),
            ]),
          ].sort(),
        },
      },
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return updatedPatient;
  });
}
