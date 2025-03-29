import { OrganizationBizType, OrganizationCreate } from "@metriport/core/domain/organization";
import { capture } from "@metriport/core/util/notifications";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError, sleep } from "@metriport/shared";
import { log } from "console";
import { UniqueConstraintError } from "sequelize";
import { OrganizationModel } from "../../../models/medical/organization";
import { createOrganizationId } from "../customer-sequence/create-id";
import { getOrganization } from "./get-organization";

const MAX_ATTEMPTS = 5;

export async function createOrganization({
  cxId,
  type,
  data,
  cqApproved,
  cqActive,
  cwApproved,
  cwActive,
}: OrganizationCreate): Promise<OrganizationModel> {
  const existingOrg = await getOrganization({ cxId });
  if (existingOrg) throw new BadRequestError(`Organization already exists for customer ${cxId}`);

  const org = await createOrganizationInternal({
    cxId,
    type,
    data,
    cqApproved,
    cqActive,
    cwApproved,
    cwActive,
  });

  log("FHIR server removed, skipping tenant and organization creation in FHIR server");

  return org;
}

async function createOrganizationInternal({
  cxId,
  type = OrganizationBizType.healthcareProvider,
  data,
  cqApproved = false,
  cqActive = false,
  cwApproved = false,
  cwActive = false,
  attempt = 1,
}: OrganizationCreate & { attempt?: number }): Promise<OrganizationModel> {
  try {
    const { oid, organizationNumber } = await createOrganizationId();
    const org = await OrganizationModel.create({
      id: uuidv7(),
      organizationNumber,
      oid,
      cxId,
      type,
      data,
      cqActive,
      cwActive,
      cqApproved,
      cwApproved,
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
        await sleep(50);
        return createOrganizationInternal({
          cxId,
          type,
          data,
          cqApproved,
          cqActive,
          cwApproved,
          cwActive,
          attempt: ++attempt,
        });
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
