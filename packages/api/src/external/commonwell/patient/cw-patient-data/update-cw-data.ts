import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientDataModel } from "../../../commonwell/models/cw-patient-data";
import { getLinkOid } from "../../../commonwell/shared";
import { getCwPatientDataOrFail } from "./get-cw-data";
import { CwLink, CwPatientData, CwPatientDataCreatePartial, isCwLinkV1 } from "./shared";
export type CwPatientDataUpdate = CwPatientDataCreatePartial & BaseUpdateCmdWithCustomer;

export async function updateCwPatientData({
  id,
  cxId,
  cwLinks,
  cwLinksToInvalidate,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cwLinks?: CwLink[];
  cwLinksToInvalidate?: CwLink[];
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

    return updateCwPatientDataWithinDBTx(
      cwPatientData,
      existingPatient,
      transaction,
      cwLinksToInvalidate
    );
  });
  return updateResult.dataValues;
}

export async function updateCwPatientDataWithinDBTx(
  update: CwPatientDataUpdate,
  existing: CwPatientDataModel,
  transaction: Transaction,
  linksToInvalidate?: CwLink[]
): Promise<CwPatientDataModel> {
  const { data: newData } = update;
  const updatedLinks = [...(newData.links ?? []), ...existing.data.links];

  const validLinks = linksToInvalidate
    ? updatedLinks.filter(link => !isContainedAt(link, linksToInvalidate))
    : updatedLinks;

  const uniqueUpdatedLinks = uniqBy(validLinks, function (nl) {
    if (isCwLinkV1(nl)) return nl.patient?.provider?.reference;
    return nl.Patient?.managingOrganization?.identifier[0]?.system;
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

function isContainedAt(link: CwLink, linksArray: CwLink[]): boolean {
  const linkOid = getLinkOid(link);

  const containsLink = linksArray.some(function (arrLink) {
    return getLinkOid(arrLink) === linkOid;
  });

  return containsLink;
}
