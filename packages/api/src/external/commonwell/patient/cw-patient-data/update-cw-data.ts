import { CwLinkV2 } from "@metriport/commonwell-sdk/models/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import _ from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientDataModel } from "../../../commonwell/models/cw-patient-data";
import { getLinkOid } from "../../../commonwell/shared";
import { getCwPatientDataOrFail } from "./get-cw-data";
import { CwData, CwLink, CwPatientData, CwPatientDataUpdateV2, isCwLinkV1 } from "./shared";
export type CwPatientDataUpdate = CwPatientDataUpdateV2 & BaseUpdateCmdWithCustomer;

export async function updateCwPatientData({
  id,
  cxId,
  cwLinksToInvalidate,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
  cwLinksToInvalidate?: CwLinkV2[];
  requestLinksDemographics?: {
    requestId: string;
    linksDemographics: LinkDemographics[];
  };
}): Promise<CwPatientData> {
  const cwPatientData: CwPatientDataUpdate = {
    id,
    cxId,
    data: {
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
  linksToInvalidate?: CwLinkV2[]
): Promise<CwPatientDataModel> {
  const updatePayload = prepareCwPatientDataUpdatePayload(update, existing, linksToInvalidate);

  return existing.update(
    {
      data: updatePayload,
    },
    { transaction }
  );
}

export function prepareCwPatientDataUpdatePayload(
  update: Pick<CwPatientDataUpdate, "data">,
  existing: CwPatientDataModel,
  linksToInvalidate?: CwLinkV2[]
): CwData {
  const { data: newLinks } = update;
  const filteredExistingV2Links = existing.data.links.filter(
    (link): link is CwLinkV2 => !isCwLinkV1(link)
  );

  // new links + existing links - important to keep in this order for uniqBy
  const uniqueUpdatedLinks = _(newLinks?.links ?? [])
    .concat(filteredExistingV2Links)
    .filter(link => !isContainedAt(link, linksToInvalidate ?? []))
    .uniqBy(link => getLinkOrganizationId(link) ?? link.Links.Self)
    .value();

  const updatedLinkDemographicsHistory = {
    ...existing.data.linkDemographicsHistory,
    ...(newLinks?.linkDemographicsHistory ?? {}),
  };

  return {
    ...existing.data,
    ...newLinks,
    links: uniqueUpdatedLinks,
    ...(newLinks?.linkDemographicsHistory && {
      linkDemographicsHistory: updatedLinkDemographicsHistory,
    }),
  };
}

function isContainedAt(link: CwLink, linksArray: CwLink[]): boolean {
  const linkOid = getLinkOid(link);

  const containsLink = linksArray.some(function (arrLink) {
    return getLinkOid(arrLink) === linkOid;
  });

  return containsLink;
}

export function getLinkOrganizationId(link: CwLinkV2): string | undefined {
  return link.Patient?.managingOrganization?.identifier[0]?.system;
}
