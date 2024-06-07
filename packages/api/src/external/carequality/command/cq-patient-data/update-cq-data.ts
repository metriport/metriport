import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CQPatientDataCreatePartial } from "../../cq-patient-data";
import { CQLink, CQPatientData } from "../../cq-patient-data";
import { CQPatientDataModel } from "../../models/cq-patient-data";
import { getCQPatientDataOrFail } from "./get-cq-data";

export type CQPatientDataUpdate = CQPatientDataCreatePartial & BaseUpdateCmdWithCustomer;

export async function updateCQPatientData({
  id,
  cxId,
  cqLinks,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cqLinks?: CQLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<CQPatientData> {
  const cqPatientData: CQPatientDataUpdate = {
    id,
    cxId,
    data: {
      ...(cqLinks && { links: cqLinks }),
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  const updateResult = await executeOnDBTx(CQPatientDataModel.prototype, async transaction => {
    const existingPatient = await getCQPatientDataOrFail({
      id,
      cxId,
      transaction,
      lock: true,
    });

    return updateCQPatientDataWithinDBTx(cqPatientData, existingPatient, transaction);
  });
  return updateResult.dataValues;
}

export async function updateCQPatientDataWithinDBTx(
  update: CQPatientDataUpdate,
  existing: CQPatientDataModel,
  transaction: Transaction
): Promise<CQPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...existing.data.links, ...(newData.links ?? [])];
  const uniqueUpdatedLinks = uniqBy(updatedLinks, "oid");
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
