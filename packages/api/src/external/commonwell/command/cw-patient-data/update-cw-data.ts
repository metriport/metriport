import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientDataCreatePartial } from "../../cw-patient-data";
import { CwLink, CwPatientData } from "../../cw-patient-data";
import { CwPatientDataModel } from "../../models/cw-patient-data";
import { getCwPatientDataOrFail } from "./get-cw-data";

const CW_OFFICIAL_ID_SYSTEM = "urn:oid:2.16.840.1.113883.3.3330.47";

export type CwPatientDataUpdate = CwPatientDataCreatePartial & BaseUpdateCmdWithCustomer;

export async function updateCwPatientData({
  id,
  cxId,
  cwLinks,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cwLinks?: CwLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<CwPatientData> {
  const cwPatientData: CwPatientDataUpdate = {
    id,
    cxId,
    data: {
      ...(cwLinks && { links: cwLinks }),
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  const updateResult = await executeOnDBTx(CwPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCwPatientDataOrFail({
      id,
      cxId,
      transaction,
      lock: true,
    });

    return updateCwPatientDataWithinDBTx(cwPatientData, existingPatient, transaction);
  });
  return updateResult.dataValues;
}

export async function updateCwPatientDataWithinDBTx(
  update: CwPatientDataUpdate,
  existing: CwPatientDataModel,
  transaction: Transaction
): Promise<CwPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...(newData.links ?? []), ...existing.data.links];
  const uniqueUpdatedLinks = uniqBy(updatedLinks, function (nl) {
    return nl.patient?.identifier?.filter(id => id.system === CW_OFFICIAL_ID_SYSTEM)[0]?.key;
  });
  const updatedLinkDemographicsHistory = {
    ...existing.data.linkDemographicsHistory,
    ...newData.linkDemographicsHistory,
  };
  return existing.update(
    {
      data: {
        ...existing.data,
        ...newData,
        links: uniqueUpdatedLinks,
        ...(newData.linkDemographicsHistory && {
          linkDemographicsHistory: updatedLinkDemographicsHistory,
        }),
      },
    },
    { transaction }
  );
}
