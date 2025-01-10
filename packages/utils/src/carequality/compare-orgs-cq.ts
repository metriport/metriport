import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { CarequalityManagementAPI } from "@metriport/carequality-sdk";
import { Organization, OrgType } from "@metriport/core/domain/organization";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import stringify from "fast-json-stable-stringify";
import fs from "fs";
import { Facility as FacilityInternal, facilitySchema } from "../internal/schemas/facility";
import {
  OrganizationBizType,
  Organization as OrganizationInternal,
  organizationSchema,
} from "../internal/schemas/organization";
import { elapsedTimeAsStr } from "../shared/duration";
import { buildGetDirPathInside, getFileNameForOrg, initRunsFolder } from "../shared/folder";
// Not happy with importing from a diff package, but it's a quick fix for now
import { Facility } from "../../../api/src/domain/medical/facility";
import { makeCarequalityManagementAPI } from "../../../api/src/external/carequality/api";
import { cmdToCqOrgDetails } from "../../../api/src/external/carequality/command/cq-organization/create-or-update-cq-organization";
import { getOrganizationFhirTemplate } from "../../../api/src/external/carequality/command/cq-organization/organization-template";
import { getCqCommand as getCqCommandForFacility } from "../../../api/src/external/carequality/command/create-or-update-facility";
import { getCqCommand as getCqCommandForOrganization } from "../../../api/src/external/carequality/command/create-or-update-organization";

dayjs.extend(duration);

/**
 * Compare Metriport generated organizations with the respective entries in the CareQuality directory.
 *
 * Stores both in the runs/compare-orgs-cq/run_<date>/ directory for further inspection.
 *
 * Note: you might need to update the files below on the API package, making the `Request` type `any`
 * because we're importing directly from that package but ts-node doesn't recognize the @types declaration
 * on the API's `tsconfig.json` file, even if we add that to Util's `tsconfig`:
 * - src/routes/auth.ts
 * - src/routes/util.ts
 *
 * To use it:
 * - Set the required env vars in .env
 *   - Also, see makeCarequalityManagementAPIFhir for required env vars.
 * - Run with `ts-node compare-orgs-cq.ts`
 */

const cxIds: string[] = [];

const apiUrl = getEnvVarOrFail("API_URL");
export const apiOssProxyInternal = axios.create({ baseURL: `${apiUrl}/internal` });

const getFolderName = buildGetDirPathInside(`compare-orgs-cq`);

export async function main() {
  await sleep(50); // just to make sure the logs are in not mixed up with Node's and other libs'
  const startedAt = Date.now();
  console.log(`########################## Started at ${new Date(startedAt).toISOString()}`);

  const cqApi = makeCarequalityManagementAPI();
  if (!cqApi) throw new Error("CQ API not initialized");

  initRunsFolder();
  const outputFolderName = getFolderName("run");
  fs.mkdirSync(outputFolderName, { recursive: true });

  for (const cxId of cxIds) {
    const { org, facilities } = await getCxData(cxId);
    const { log } = out(`${cxId} / ${org.name}`);

    const inputMetriportOrg: Organization = {
      cxId,
      id: org.id,
      organizationNumber: Number(org.oid.split(":")[-1]),
      type: org.businessType,
      data: {
        name: org.name,
        location: org.location,
        type: org.type as unknown as OrgType,
      },
      oid: org.oid,
      cqActive: org.cqActive ?? false,
      cqApproved: org.cqApproved ?? false,
      cwActive: org.cwActive ?? false,
      cwApproved: org.cwApproved ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
      eTag: org.eTag ?? "",
    };

    if (org.businessType === OrganizationBizType.healthcareProvider) {
      log(`Provider - Processing org...`);
      if (!org.cqActive || !org.cqApproved) {
        log(`Skipping ${org.name} because it is not active or approved in CQ`);
        continue;
      }
      const cqCmd = getCqCommandForOrganization({ org: inputMetriportOrg });
      const cqOrgDetails = await cmdToCqOrgDetails(cqCmd);
      const metriportOrg = getOrganizationFhirTemplate(cqOrgDetails);
      await process("org", org, metriportOrg, outputFolderName, cqApi);
      // empty line
    } else if (org.businessType === OrganizationBizType.healthcareITVendor) {
      log(`IT Vendor - Processing ${facilities.length} facilities...`);
      for (const facility of facilities) {
        if (!facility.cqActive || !facility.cqApproved) {
          log(`... facility ${facility.id} is not approved/active in CQ, skipping`);
          continue;
        }
        const inputFacility: Facility = {
          cxId,
          id: facility.id,
          oid: facility.oid,
          facilityNumber: Number(facility.oid.split(":")[-1]),
          data: {
            name: facility.name,
            address: facility.address,
            npi: facility.npi,
            active: facility.active == undefined ? undefined : facility.active,
          },
          cqType: facility.cqType,
          cqOboOid: facility.cqOboOid,
          cqActive: facility.cqActive ?? false,
          cqApproved: facility.cqApproved ?? false,
          cwActive: facility.cwActive ?? false,
          cwApproved: facility.cwApproved ?? false,
          cwOboOid: facility.cwOboOid,
          cwType: facility.cwType,
          createdAt: new Date(),
          updatedAt: new Date(),
          eTag: facility.eTag ?? "",
        };
        const cqCmd = getCqCommandForFacility({ org: inputMetriportOrg, facility: inputFacility });
        const cqOrgDetails = await cmdToCqOrgDetails(cqCmd);
        const metriportOrg = getOrganizationFhirTemplate(cqOrgDetails);
        await process("fac", facility, metriportOrg, outputFolderName, cqApi);
      }
    } else {
      throw new Error(`Unsupported business type: ${org.businessType}`);
    }
    log(`Done`);
  }

  console.log(`>>> ALL Done in ${elapsedTimeAsStr(startedAt)}`);
}

async function process(
  type: "org" | "fac",
  org: { oid: string; name: string },
  metriportOrg: unknown,
  outputFolderName: string,
  cqApi: CarequalityManagementAPI
): Promise<void> {
  const cqOrgs = await cqApi.listOrganizations({ oid: org.oid });
  if (cqOrgs.length < 1) console.log(`No CQ organizations found for ${org.oid} / ${org.name}`);

  if (cqOrgs.length > 1) {
    console.log(`cqOrgs`, cqOrgs);
    throw new Error(`Found more than one CQ organization for ${org.oid}`);
  }
  const cqOrg = cqOrgs[0] ?? "NOT_FOUND";

  const pathAndPrefix = outputFolderName + "/" + type + "_";
  const outputFileNameMetriport = getFileNameForOrg(org.name + "_metriport");
  const outputFileNameCq = getFileNameForOrg(org.name + "_cq");

  const outputCq = JSON.stringify(JSON.parse(stringify(cqOrg)), null, 2);
  fs.writeFileSync(pathAndPrefix + outputFileNameCq, outputCq);

  const outputMetriport = JSON.stringify(JSON.parse(stringify(metriportOrg)), null, 2);
  fs.writeFileSync(pathAndPrefix + outputFileNameMetriport, outputMetriport);
}

async function getCxData(
  cxId: string
): Promise<{ org: OrganizationInternal; facilities: FacilityInternal[] }> {
  const resp = await apiOssProxyInternal.get(`/cx-data?cxId=${cxId}`);
  if (!resp.data) throw new Error(`Cx data not returned`);
  return {
    org: organizationSchema.parse(resp.data["org"]),
    facilities: resp.data["facilities"].map(facilitySchema.parse),
  };
}

main();
