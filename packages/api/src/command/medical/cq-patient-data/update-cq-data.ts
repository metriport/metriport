import { uniqBy } from "lodash";
import { PatientCQDataCreate } from "../../../domain/medical/cq-patient-data";
import { PatientCQDataModel } from "../../../models/medical/cq-patient-data";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientCQDataOrFail } from "./get-cq-data";

export type PatientCQDataUpdate = PatientCQDataCreate & BaseUpdateCmdWithCustomer;

export async function updatePatientCQData(cqData: PatientCQDataUpdate) {
  const { id, cxId } = cqData;

  return executeOnDBTx(PatientCQDataModel.prototype, async transaction => {
    const patientCQData = await getPatientCQDataOrFail({
      id,
      cxId,
    });

    const updatedLinks = [...patientCQData.data.links, ...cqData.data.links];
    const uniqueLinks = uniqBy(updatedLinks, "oid");

    return patientCQData.update(
      {
        data: {
          links: uniqueLinks,
        },
      },
      { transaction }
    );
  });
}
