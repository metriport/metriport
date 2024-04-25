import proxy from "express-http-proxy";
import Router from "express-promise-router";
import NotFoundError from "../../errors/not-found";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";
import { asyncHandler, getCxIdOrFail } from "../util";

export type fhirLink = {
  relation: "self" | "next" | "previous";
  url: string;
};

export type fhirEntry = {
  fullUrl: string;
  resource: {
    // TODO: Incomplete type
    resourceType: string;
    id: string;
  };
  search: {
    // TODO: Incomplete type
    mode: string;
  };
};

const { log } = Util.out(`FHIR-R4-PROXY`);

const fhirRouter = (fhirServerUrl: string) =>
  proxy(fhirServerUrl, {
    proxyReqPathResolver: function (req) {
      log(`ORIGINAL HEADERS: `, JSON.stringify(req.headers));
      log(`ORIGINAL URL: `, req.url);
      const cxId = getCxIdOrFail(req);
      const updatedURL = `/fhir/${cxId}` + req.url;
      log(`Proxying to FHIR server: ${updatedURL}`);
      return updatedURL;
    },
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
      const data = JSON.parse(proxyResData.toString("utf8"));
      // v1 handle only known use case `/fhir/R4/{resource}`
      if (data["resourceType"] === "Bundle" && "type" in data && data["type"] === "searchset") {
        if ("link" in data) {
          data["link"].forEach((link: fhirLink) => {
            const defaultPaginationQueryParams = {
              _getpages: data["id"],
              _getpagesoffset: "0",
              _count: "20",
              _pretty: "true",
              _bundletype: "searchset",
            };
            let queryParams = link.url.includes("?")
              ? link.url
                  .split("?")[1]
                  .split("&")
                  .reduce((a, v) => ({ ...a, [v.split("=")[0]]: v.split("=")[1] }), {})
              : {};
            queryParams = {
              ...defaultPaginationQueryParams,
              ...queryParams,
            };
            link.url =
              Config.getApiUrl() +
              userReq.baseUrl +
              "?" +
              Object.entries(queryParams)
                .map(entry => `${entry[0]}=${entry[1]}`)
                .join("&");
          });
        }
        if ("entry" in data) {
          data["entry"].forEach((entry: fhirEntry) => {
            entry.fullUrl =
              Config.getApiUrl() +
              userReq.baseUrl +
              "/" +
              entry.resource.resourceType +
              "/" +
              entry.resource.id;
          });
        }
      }
      return JSON.stringify(data);
    },
  });

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError(`FHIR server is disabled`);
  })
);

const fhirServerUrl = Config.getFHIRServerUrl();

const router = fhirServerUrl ? fhirRouter(fhirServerUrl) : dummyRouter;

export default router;
