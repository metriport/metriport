import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { EhexLink, EhexPatientData, EhexPatientDataCreatePartial } from "../../ehex-patient-data";
import { EhexPatientDataModel } from "../../models/ehex-patient-data";
import { getEhexPatientDataModelOrFail } from "./get-ehex-data";

export type EhexPatientDataUpdate = EhexPatientDataCreatePartial & BaseUpdateCmdWithCustomer;

export async function updateEhexPatientData({
  id,
  cxId,
  ehexLinks,
  ehexLinksToInvalidate,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  ehexLinks?: EhexLink[];
  ehexLinksToInvalidate?: EhexLink[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<EhexPatientData> {
  const ehexPatientData: EhexPatientDataUpdate = {
    id,
    cxId,
    data: {
      ...(ehexLinks && { links: ehexLinks }),
      ...(requestLinksDemographics && {
        linkDemographicsHistory: {
          [requestLinksDemographics.requestId]: requestLinksDemographics.linksDemographics,
        },
      }),
    },
  };

  const updateResult = await executeOnDBTx(EhexPatientDataModel.prototype, async transaction => {
    const existingPatient = await getEhexPatientDataModelOrFail({
      id,
      cxId,
      transaction,
      lock: true,
    });

    return updateEhexPatientDataWithinDBTx(
      ehexPatientData,
      existingPatient,
      transaction,
      ehexLinksToInvalidate
    );
  });
  return updateResult.dataValues;
}

export async function updateEhexPatientDataWithinDBTx(
  update: EhexPatientDataUpdate,
  existing: EhexPatientDataModel,
  transaction: Transaction,
  ehexLinksToInvalidate?: EhexLink[]
): Promise<EhexPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...(newData.links ?? []), ...existing.data.links];

  const validLinks = ehexLinksToInvalidate
    ? updatedLinks.filter(link => !ehexLinksToInvalidate.some(invalid => invalid.oid === link.oid))
    : updatedLinks;

  const uniqueUpdatedLinks = uniqBy(validLinks, link => `${link.systemId}-${link.patientId}`);
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
