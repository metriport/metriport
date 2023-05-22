import { Bundle } from "@medplum/fhirtypes";
import { Request, Response } from "express";
import Router from "express-promise-router";
import { postBundle } from "../../external/fhir/bundle";
import { capture } from "../../shared/notifications";
import { asyncHandler, getFrom } from "../util";

const router = Router();

router.post(
  "/result-conversion",
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getFrom("query").orFail("cxId", req);
    capture.setUser({ id: cxId });

    // TODO 706 validate the incoming request?
    const fhirBundle: Bundle = req.body.fhirResource;
    console.log(`Received conversion result, length ${req.headers["content-length"]}`);

    // Intentionally asynchronous
    if (fhirBundle) postBundle(cxId, fhirBundle);

    return res.sendStatus(200);
  })
);

export default router;
