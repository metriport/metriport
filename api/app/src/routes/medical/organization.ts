import { Request, Response } from "express";
import Router from "express-promise-router";
import { Organization as CWOrganization } from "@metriport/commonwell-sdk";

import { organizationSchema } from "../../mappings/medical//models/organization";
import { asyncHandler, getCxIdOrFail } from "../util";
const router = Router();
import status from "http-status";
import { updateOrganization } from "../../command/medical/organization/update-organization";
import { createOrganization } from "../../command/medical/organization/create-organization";
import { getOrganization } from "../../command/medical/organization/get-organization";
import { Organization } from "../../models/medical/organization";
import { commonWellMember, queryMeta, CW_ID_PREFIX } from "../../shared/commonwell";
import { Config } from "../../shared/config";

/** ---------------------------------------------------------------------------
 * POST /organization
 *
 * Updates or creates the organization if it doesn't exist already.
 *
 * @return  {Organization}  The organization.
 */
router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const reqOrgData = organizationSchema.parse(req.body);

    // TODO: I FIGURED THESE 3 WOULD BE GOOD TO STORE IN DB
    // CAN ADD GATEWAYS OR TECHNICAL CONTACT ETC.
    const localOrgPayload = {
      name: reqOrgData.name,
      type: "Hospital",
      locations: reqOrgData.locations,
    };

    // update if this is an existing org
    let localOrg: Organization;

    if (reqOrgData.id) {
      const data = { ...reqOrgData };
      delete data.id;
      localOrg = await updateOrganization({ id: reqOrgData.id, cxId, data: localOrgPayload });
    } else {
      localOrg = await createOrganization({ cxId, data: localOrgPayload });
    }

    const cwOrgPayload: CWOrganization = {
      ...localOrgPayload,
      // NOTE: IN STAGING IF THE ID ALREADY EXISTS IT WILL SAY INVALID ORG WHEN CREATING
      organizationId: `${CW_ID_PREFIX}${localOrg.id}`,
      homeCommunityId: `${CW_ID_PREFIX}${localOrg.id}`,
      patientIdAssignAuthority: `${CW_ID_PREFIX}${localOrg.id}`,
      displayName: reqOrgData.name,
      memberName: "Metriport",
      securityTokenKeyType: "BearerKey",
      isActive: true,
      gateways: [
        {
          serviceType: "XCA_Query",
          gatewayType: "R4",
          endpointLocation: Config.getGatewayEndpointLocation(),
        },
      ],
      authorizationInformation: {
        authorizationServerEndpoint: Config.getGatewayAuthorizationServerEndpoint(),
        clientId: Config.getGatewayAuthorizationClientId(),
        clientSecret: Config.getGatewayAuthorizationClientSecret(),
        documentReferenceScope: "fhir/document",
        binaryScope: "fhir/document",
      },
      technicalContacts: [
        {
          name: "Metriport Team",
          title: "Engineering",
          email: "support@metriport.com",
          phone: "(415)-941-3282",
        },
      ],
    };

    try {
      if (reqOrgData.id) {
        await commonWellMember.updateOrg(queryMeta, cwOrgPayload, `${reqOrgData.id}`);
      } else {
        await commonWellMember.createOrg(queryMeta, cwOrgPayload);
      }
    } catch (error) {
      console.log("Error creating or updating cw org", error);
    }

    return res.status(status.OK).json({ id: localOrg.id, ...localOrg.data });
  })
);

/** ---------------------------------------------------------------------------
 * GET /organization
 *
 * Gets the org corresponding to the customer ID.
 *
 * @return  {Organization}  The organization.
 */
router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);

    const org = await getOrganization({ cxId });

    return res.status(status.OK).json(org ? { id: org.id, ...org.data } : undefined);
  })
);

export default router;
