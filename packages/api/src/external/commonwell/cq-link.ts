import dayjs from "dayjs";
import { cloneDeep } from "lodash";
import { Op } from "sequelize";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { Patient } from "../../domain/medical/patient";
import { PatientModel } from "../../models/medical/patient";
import { CQLinkStatus } from "./patient-shared";

/**
 * Get the list of patients to be linked with CareQuality Orgs.
 */
export const getPatientsToCQLink = async (cxId?: string | undefined): Promise<string[]> => {
  const earliestDate = dayjs().subtract(3, "minutes").toDate();
  const cqLinkStatuses: CQLinkStatus[] = ["linked", "processing"];
  const patients = await PatientModel.findAll({
    attributes: ["id"],
    where: {
      ...(cxId ? { cxId } : {}),
      // "data.externalData.COMMONWELL.cqLinkStatus": "NOT_LINKED",
      data: {
        externalData: {
          COMMONWELL: {
            cqLinkStatus: {
              [Op.notIn]: cqLinkStatuses,
            },
          },
        },
      },
      createdAt: { [Op.lte]: earliestDate },
    },
  });
  return patients.map(p => p.id);
};

/**
 * Set the CQ link status on the patient.
 */
export const setCQLinkStatus = async ({
  patientId,
  cxId,
  cqLinkStatus,
}: {
  patientId: string;
  cxId: string;
  cqLinkStatus?: CQLinkStatus | undefined;
}): Promise<Patient> => {
  const updatedPatient = await getPatientOrFail({ id: patientId, cxId });

  const updatedData = cloneDeep(updatedPatient.data);
  updatedData.externalData = {
    ...updatedData.externalData,
    COMMONWELL: {
      ...updatedData.externalData?.COMMONWELL,
      cqLinkStatus,
    },
  };

  return updatedPatient.update({ data: updatedData });
};
