import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { EhexLink, EhexPatientData, EhexPatientDataCreate } from "../../ehex-patient-data";
import { EhexPatientDataModel } from "../../models/ehex-patient-data";
import { getEhexPatientDataModel } from "./get-ehex-data";
import { updateEhexPatientDataWithinDBTx } from "./update-ehex-data";

export async function createOrUpdateEhexPatientData({
  id,
  cxId,
  ehexLinks,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  ehexLinks: EhexLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<EhexPatientData> {
  const ehexPatientData: EhexPatientDataCreate = {
    id,
    cxId,
    data: {
      links: ehexLinks,
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  return await executeOnDBTx(EhexPatientDataModel.prototype, async transaction => {
    const existingPatient = await getEhexPatientDataModel({
      id,
      cxId,
      transaction,
      lock: true,
    });
    if (existingPatient) {
      const updated = await updateEhexPatientDataWithinDBTx(
        ehexPatientData,
        existingPatient,
        transaction
      );
      return updated.dataValues;
    }
    return await EhexPatientDataModel.create(ehexPatientData, { transaction });
  });
}
