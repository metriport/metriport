import { parseOid } from "@metriport/shared/common/normalize-oid";
import { uniqBy } from "lodash";
import { Transaction } from "sequelize";
import { BaseUpdateCmdWithCustomer } from "../../../command/medical/base-update-command";
import { InvalidLinks, InvalidLinksCreate, InvalidLinksData } from "../../../domain/invalid-links";
import { isCwLinkV1 } from "../../../external/commonwell/patient/cw-patient-data/shared";
import { InvalidLinksModel } from "../../../models/invalid-links";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getInvalidLinksOrFail } from "./get-invalid-links";
export type InvalidLinksUpdate = InvalidLinksCreate & BaseUpdateCmdWithCustomer;

export async function updateInvalidLinks({
  id,
  cxId,
  invalidLinks,
}: {
  id: string;
  cxId: string;
  invalidLinks?: InvalidLinksData;
}): Promise<InvalidLinks> {
  const invalidLinksUpdate: InvalidLinksUpdate = {
    id,
    cxId,
    data: invalidLinks ?? {},
  };

  const updateResult = await executeOnDBTx(InvalidLinksModel.prototype, async transaction => {
    const existingInvalidLinks = await getInvalidLinksOrFail({ id, cxId, transaction, lock: true });

    return updateInvalidLinksWithinDbTx(invalidLinksUpdate, existingInvalidLinks, transaction);
  });
  return updateResult;
}

export async function updateInvalidLinksWithinDbTx(
  update: InvalidLinksUpdate,
  existing: InvalidLinksModel,
  transaction: Transaction
): Promise<InvalidLinks> {
  const { data: newData } = update;

  const updatedData = {
    carequality: [...(existing.data.carequality ?? []), ...(newData.carequality ?? [])],
    commonwell: [...(existing.data.commonwell ?? []), ...(newData.commonwell ?? [])],
  };

  const uniqueUpdatedData = {
    carequality: uniqBy(updatedData.carequality, "oid"),
    commonwell: uniqBy(updatedData.commonwell, function (networkLink) {
      if (isCwLinkV1(networkLink)) {
        // example: "https://org-address.org/v1/org/2.16.840.<rest-of-oid>/"
        const providerReference = networkLink.patient?.provider?.reference;
        if (!providerReference) return JSON.stringify(networkLink);
        try {
          return parseOid(providerReference);
        } catch {
          return JSON.stringify(networkLink);
        }
      } else {
        // example: "urn:oid:2.16.840.<rest-of-oid>"
        const systemReference = networkLink.Patient?.managingOrganization?.identifier?.[0]?.system;
        if (!systemReference) return JSON.stringify(networkLink);
        try {
          return parseOid(systemReference);
        } catch {
          return JSON.stringify(networkLink);
        }
      }
    }),
  };

  const result = await existing.update(
    {
      data: uniqueUpdatedData,
    },
    { transaction }
  );

  return result.dataValues;
}
