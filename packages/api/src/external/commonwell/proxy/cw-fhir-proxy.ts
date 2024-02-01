import NotFoundError from "@metriport/core/util/error/not-found";
import Router from "express-promise-router";
import { asyncHandler } from "../../../routes/util";
import { processRequest } from "./cw-process-request";
import { fhirServerUrl } from "./shared";

/**
 * Endpoints to process CW's Document Query (DQ) requests.
 *
 * Example of a DQ request:
 *   /DocumentReference?
 *   &_include=DocumentReference:patient
 *   &_include=DocumentReference:subject
 *   &_include=DocumentReference:authenticator
 *   &_include=DocumentReference:author
 *   &_include=DocumentReference:custodian
 *   &_include=DocumentReference:encounter
 *   &category=('34133-9%5E%5E2.16.840.1.113883.6.1')
 *   &patient.identifier=urn:oid:2.16.840.1.113883.3.9621.5.000%7C508fd256-8748-4c36-a960-6d92feecbb9a
 *   &status=current
 */

const fhirRouter = Router();
fhirRouter.get(
  "/DocumentReference",
  asyncHandler(async (req, res) => {
    const bundle = await processRequest(req);
    return res.status(200).json(bundle);
  })
);
fhirRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError();
  })
);

const dummyRouter = Router();
dummyRouter.all(
  "/*",
  asyncHandler(async () => {
    throw new NotFoundError(`FHIR server for CW is disabled`);
  })
);

const router = fhirServerUrl ? fhirRouter : dummyRouter;

export default router;
