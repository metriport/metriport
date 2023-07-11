import proxy from "express-http-proxy";
import Router from "express-promise-router";
import NotFoundError from "../../errors/not-found";
import { Config } from "../../shared/config";
import { Util } from "../../shared/util";
import { asyncHandler, getCxIdOrFail } from "../util";

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
