/* eslint-disable @typescript-eslint/no-explicit-any */
import proxy from "express-http-proxy";
import Router from "express-promise-router";
import NotFoundError from "../../errors/not-found";
import { Organization, OrganizationModel } from "../../models/medical/organization";
import { asyncHandler } from "../../routes/util";
import { Config } from "../../shared/config";

const fhirServerUrl = Config.getFHIRServerUrl();

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError(`CW FHIR server is disabled`);
  })
);

const updateDocumentReferenceQueryString = (params: string): string => {
  const decodedParams = decodeURIComponent(decodeURI(params));
  return (
    decodedParams
      .replace(/patient\.identifier/i, "patient")
      // eslint-disable-next-line no-useless-escape
      .replace(/urn\:oid\:.+\|(2\.[\.\d]+)/g, "$1")
  );
};
const updateQueryString = (path: string, params: string): string | undefined => {
  if (path.toLocaleLowerCase().includes("documentreference")) {
    return updateDocumentReferenceQueryString(params);
  }
  return undefined;
};

// Didn't reuse getOrganizationOrFail bc we don't have `cxId` in this context and
// we want to keep that function requiring `cxId` to avoid cross-tenant data access
async function getOrgOrFail(orgId: string): Promise<Organization> {
  const org = await OrganizationModel.findByPk(orgId);
  if (!org) throw new NotFoundError(`Could not find organization`);
  return org;
}

const router = fhirServerUrl
  ? proxy(fhirServerUrl, {
      proxyReqPathResolver: async function (req) {
        console.log(`ORIGINAL HEADERS: `, JSON.stringify(req.headers));
        console.log(`ORIGINAL URL: `, req.url);
        const parts = req.url.split("?");
        const path = parts[0];
        const queryString = parts[1];

        const queryParams = new URLSearchParams(queryString);
        const patienIdRaw = queryParams.get("patient.identifier")?.split("|") ?? [];
        const orgId = patienIdRaw[1];
        const org = await getOrgOrFail(orgId);
        const tenant = org.cxId;

        const queryStringUpdated =
          parts.length > 1 ? updateQueryString(path, queryString) : undefined;
        const updatedURL =
          `/fhir/${tenant}` + path + (queryStringUpdated ? "?" + queryStringUpdated : "");
        console.log(`UPDATED URL: `, updatedURL);
        return updatedURL;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
        try {
          const payloadString = proxyResData.toString("utf8");
          console.log(`ORIGINAL RESPONSE: `, JSON.stringify(JSON.parse(payloadString)));
          const updatedPayload = payloadString;
          const payload = JSON.parse(updatedPayload);
          console.log(`UPDATED RESPONSE: `, JSON.stringify(payload));
          return JSON.stringify(payload);
        } catch (err) {
          console.log(`Error parsing/transforming response: `, err);
          console.log(`RAW, ORIGINAL RESPONSE: `, proxyResData);
          return proxyResData;
        }
      },
    })
  : dummyRouter;

export default router;
