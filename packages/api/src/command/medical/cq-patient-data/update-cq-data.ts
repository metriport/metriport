import { CQLink, PatientCQDataCreate } from "../../../domain/medical/cq-patient-data";
import { validateVersionForUpdate } from "../../../models/_default";
import { PatientCQDataModel } from "../../../models/medical/cq-patient-data";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getPatientCQDataOrFail } from "./get-cq-data";

export type PatientCQDataUpdate = PatientCQDataCreate & BaseUpdateCmdWithCustomer;

export async function updatePatientCQData(cqData: PatientCQDataUpdate) {
  const { id, cxId, eTag } = cqData;

  return executeOnDBTx(PatientCQDataModel.prototype, async transaction => {
    const patient = await getPatientCQDataOrFail({
      id,
      cxId,
    });

    validateVersionForUpdate(patient, eTag);

    const updatedLinks = [...patient.data.links, ...cqData.data.links];
    const uniqueLinks = removeDuplicates(updatedLinks);

    return patient.update(
      {
        data: {
          links: uniqueLinks,
        },
      },
      { transaction }
    );
  });
}

function removeDuplicates(updatedLinks: CQLink[]): CQLink[] {
  const uniqueLinks = new Map();

  for (const link of updatedLinks) {
    const gatewayOid = link.oid;

    if (!uniqueLinks.has(gatewayOid)) {
      uniqueLinks.set(gatewayOid, link);
    }
  }

  return Array.from(uniqueLinks.values());
}
