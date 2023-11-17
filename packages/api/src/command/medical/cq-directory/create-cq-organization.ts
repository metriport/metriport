import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { UniqueConstraintError } from "sequelize";
import { CQDirectoryModel } from "../../../models/medical/cq-directory";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { getCQOrganization } from "./get-organization";
import { updateCQDirectoryOrganization } from "./update-organization";
import { Organization } from "@metriport/carequality-sdk/models/organization";

const MAX_ATTEMPTS = 5;

export type CQDirectoryOrg = {
  oid: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  name?: string;
  latitude?: string;
  longitude?: string;
  data?: Organization;
  state?: string;
};

export type CQDirectoryModelCreate = { org: CQDirectoryModel } & {
  updated?: number;
  added?: number;
};

export const createCQOrganization = async (
  orgData: CQDirectoryOrg
): Promise<CQDirectoryModelCreate> => {
  // ensure we never create more than one entry per cq org
  const existingOrg = await getCQOrganization({ oid: orgData.oid });
  if (existingOrg) {
    const updOrg = await updateCQDirectoryOrganization({ existingOrg, newData: orgData });
    return { org: updOrg, updated: 1 };
  }

  const org = await createDirectoryOrganization(orgData);

  return {
    org,
    added: 1,
  };
};

async function createDirectoryOrganization(
  orgData: CQDirectoryOrg,
  attempt = 1
): Promise<CQDirectoryModel> {
  try {
    const { oid, name, urlXCPD, urlDQ, urlDR, state, latitude, longitude, data } = orgData;

    const org = await CQDirectoryModel.create({
      id: uuidv7(),
      oid,
      name,
      urlXCPD,
      urlDQ,
      urlDR,
      latitude,
      longitude,
      state,
      data,
    });

    return org;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof UniqueConstraintError) {
      const msg = "Collision creating cq directory organization id";
      if (attempt < MAX_ATTEMPTS) {
        console.log(`${msg}, retrying...`);
        if (attempt === 1) {
          capture.message(msg, {
            extra: { error, retrying: true },
            level: "warning",
          });
        }
        await Util.sleep(50);
        return createDirectoryOrganization(orgData, ++attempt);
      }
      console.log(`${msg}, NOT RETRYING!`);
      capture.message(msg + " - NOT RETRYING", {
        extra: { error, retrying: false },
        level: "error",
      });
    }
    throw error;
  }
}
