import { Router } from "express";
import fhirProxy from "../external/commonwell/cw-fhir-proxy";

const router = Router();

router.use("/fhir", fhirProxy);

export default router;
