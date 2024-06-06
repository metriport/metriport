import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwLink, CwPatientData, CwPatientDataCreate } from "../../cw-patient-data";
import { CwPatientDataModel } from "../../models/cw-patient-data";
import { getCwPatientData } from "./get-cw-data";
import { updateCwPatientDataWithinDBTx } from "./update-cw-data";

export async function createOrUpdateCwPatientData({
  id,
  cxId,
  cwLinks,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cwLinks: CwLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<CwPatientData> {
  const cwPatientData: CwPatientDataCreate = {
    id,
    cxId,
    data: {
      links: cwLinks,
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  const updateResult = await executeOnDBTx(CwPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCwPatientData({
      id,
      cxId,
      transaction,
      lock: true,
    });
    if (!existingPatient) return undefined;
    return updateCwPatientDataWithinDBTx(cwPatientData, existingPatient, transaction);
  });
  if (updateResult) return updateResult;

  return await CwPatientDataModel.create(cwPatientData);
}
