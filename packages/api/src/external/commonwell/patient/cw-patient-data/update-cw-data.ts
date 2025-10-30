import { CwLinkV2 } from "@metriport/commonwell-sdk/models/patient";
import { LinkDemographics } from "@metriport/core/domain/patient-demographics";
import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../../command/medical/base-update-command";
import { executeOnDBTx } from "../../../../models/transaction-wrapper";
import { CwPatientDataModel } from "../../../commonwell/models/cw-patient-data";
import { getLinkOid } from "../../../commonwell/shared";
import { getCwPatientDataOrFail } from "./get-cw-data";
import { CwData, CwLink, CwPatientData, CwPatientDataCreatePartialV2, isCwLinkV1 } from "./shared";
export type CwPatientDataUpdate = CwPatientDataCreatePartialV2 & BaseUpdateCmdWithCustomer;

export async function updateCwPatientData({
  id,
  cxId,
  cwLinksToInvalidate,
  requestLinksDemographics,
}: {
  id: string;
  cxId: string;
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
  linksToInvalidate?: CwLink[]
): CwData {
  const { data: newLinks } = update;

  // Remove all CW v1 links from existing data, keep only v2 links
  const existingV2Links = existing.data.links.filter(link => !isCwLinkV1(link)) as CwLinkV2[];

  // Merge new v2 links with existing v2 links only (newLinks.links should only contain v2 links)
  const updatedLinks: CwLinkV2[] = [...(newLinks?.links ?? []), ...existingV2Links];

  const validLinks = linksToInvalidate
    ? updatedLinks.filter(link => !isContainedAt(link, linksToInvalidate))
    : updatedLinks;

  const uniqueUpdatedLinks = uniqBy(
    validLinks,
    link => getLinkOrganizationId(link) ?? link.Links.Self
  );
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
