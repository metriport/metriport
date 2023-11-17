import { UniqueConstraintError } from "sequelize";
import { CQDirectoryModel } from "../../../models/medical/cq-directory";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { USState } from "@metriport/core/domain/geographic-locations";
import { OrgType } from "../../../domain/medical/organization";

const MAX_ATTEMPTS = 5;

export type CQDirectoryOrg = {
  oid: string;
  urlXCPD: string;
  urlDQ?: string;
  urlDR?: string;
  name?: string;
  latitude?: string;
  longitude?: string;
  data?: unknown; // unknown if we don't know
  state?: string;
};

export const createCQOrganization = async (orgData: CQDirectoryOrg): Promise<CQDirectoryModel> => {
  // ensure we never create more than one entry per cq org
  //   const existingOrg = await getOrganization({ cxId });
  //   if (existingOrg) throw new BadRequestError(`Organization already exists for customer ${cxId}`);

  const org = await createDirectoryOrganization(orgData);

  return org;
};

async function createDirectoryOrganization(
  orgData: CQDirectoryOrg,
  attempt = 1
): Promise<CQDirectoryModel> {
  try {
    // const { oid, name, urlXCPD, urlDQ, urlDR, state, latitude, longitude, data } = orgData;

    // const org = await CQDirectoryModel.create({
    //   id: uuidv7(),
    //   oid,
    //   name,
    //   urlXCPD,
    //   urlDQ,
    //   urlDR,
    //   latitude,
    //   longitude,
    //   state,
    //   data,
    // });
    // const org = await CQDirectoryModel.create({
    //   id: orgId,
    //   // ...orgData,
    // });
    const testOrgData = {
      cxId: "718c4207-a059-4c96-87e7-36dab0822ae2",
      name: "Ramil's main office",
      type: OrgType.acuteCare,
      location: {
        zip: "85300",
        city: "Phoenix",
        state: USState.AZ,
        country: "USA",
        addressLine1: "125 Arsenal St",
      },
    };

    const { cxId, name, type, location } = testOrgData;

    const oid = "1.1.123.23";
    const organizationNumber = 2;

    const createData = {
      // id: uuidv7(),
      id: "018a05fa-b4b5-7394-be94-4c5f6620020f",
      oid,
      organizationNumber,
      cxId,
      data: { name, type, location },
    };
    console.log("CreateData", createData);

    const org = await CQDirectoryModel.create(createData);
    console.log("Complete!");
    return org;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.log("ERRORRRR!!!!");
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
