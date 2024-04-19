import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { UniqueConstraintError } from "sequelize";
import { OrganizationData } from "@metriport/core/domain/organization";
import BadRequestError from "../../../errors/bad-request";
import { createTenantIfNotExists } from "../../../external/fhir/admin";
import { OrganizationModel, OrganizationType } from "../../../models/medical/organization";
import { capture } from "../../../shared/notifications";
import { Util } from "../../../shared/util";
import { createOrganizationId } from "../customer-sequence/create-id";
import { getOrganization } from "./get-organization";

const MAX_ATTEMPTS = 5;

type Identifier = Pick<OrganizationModel, "cxId">;
type OrganizationNoExternalData = Omit<OrganizationData, "externalData">;
export type OrganizationCreateCmd = OrganizationNoExternalData & Identifier;

export const createOrganization = async (
  orgData: OrganizationCreateCmd
): Promise<OrganizationModel> => {
  const { cxId } = orgData;

  // ensure we never create more than one org per customer
  const existingOrg = await getOrganization({ cxId });
  if (existingOrg) throw new BadRequestError(`Organization already exists for customer ${cxId}`);

  const org = await createOrganizationInternal(orgData);

  // create tenant on FHIR server
  await createTenantIfNotExists(org);

  return org;
};

async function createOrganizationInternal(
  orgData: OrganizationCreateCmd,
  orgType: OrganizationType = OrganizationType.healthcareProvider,
  attempt = 1
): Promise<OrganizationModel> {
  try {
    const { cxId, name, type, location } = orgData;

    const { oid, organizationNumber } = await createOrganizationId();

    const org = await OrganizationModel.create({
      id: uuidv7(),
      oid,
      type: orgType,
      organizationNumber,
      cxId,
      data: { name, type, location },
    });

    return org;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error instanceof UniqueConstraintError) {
      const msg = "Collision creating organization id";
      if (attempt < MAX_ATTEMPTS) {
        console.log(`${msg}, retrying...`);
        if (attempt === 1) {
          capture.message(msg, {
            extra: { error, retrying: true },
            level: "warning",
          });
        }
        await Util.sleep(50);
        return createOrganizationInternal(orgData, orgType, ++attempt);
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
