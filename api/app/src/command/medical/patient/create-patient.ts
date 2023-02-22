import { Patient } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { OIDNode } from "../../../shared/oid";

export const createPatient = async ({
  organizationNumber,
  facilityId,
  cxId,
  data,
}: {
  organizationNumber: number;
  facilityId: string;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  const patient = await Patient.create({
    id: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${organizationNumber}.${
      OIDNode.patients
    }.`, // the patient number will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    patientNumber: 0, // this will be generated on the beforeCreate hook
    data,
  });
  return patient;
};
