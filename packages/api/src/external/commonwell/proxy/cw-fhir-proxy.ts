import proxy from "express-http-proxy";
import Router from "express-promise-router";
import NotFoundError from "../../../errors/not-found";
import { asyncHandler } from "../../../routes/util";
import { proxyRequest } from "./process-inbound";
import { processResponse } from "./process-outbound";
import { fhirServerUrl } from "./shared";

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError(`CW FHIR server is disabled`);
  })
);

const router = fhirServerUrl
  ? proxy(fhirServerUrl, {
      proxyReqPathResolver: proxyRequest,
      userResDecorator: processResponse,
    })
  : dummyRouter;

export default router;
