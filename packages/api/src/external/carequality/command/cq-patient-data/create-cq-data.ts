import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQLink, CQPatientData, CQPatientDataCreate } from "../../cq-patient-data";
import { CQPatientDataModel } from "../../models/cq-patient-data";
import { getCQPatientData } from "./get-cq-data";
import { updateCQPatientDataWithinDBTx } from "./update-cq-data";

export async function createOrUpdateCQPatientData({
  id,
  cxId,
  cqLinks,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cqLinks: CQLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<CQPatientData> {
  const cqPatientData: CQPatientDataCreate = {
    id,
    cxId,
    data: {
      links: cqLinks,
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  const updateResult = await executeOnDBTx(CQPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCQPatientData({
      id,
      cxId,
      transaction,
      lock: true,
    });
    if (!existingPatient) return undefined;
    return updateCQPatientDataWithinDBTx(cqPatientData, existingPatient, transaction);
  });
  if (updateResult) return updateResult.dataValues;

  return await CQPatientDataModel.create(cqPatientData);
}
