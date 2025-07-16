import { Router } from "express";
import fhirProxy from "../external/commonwell-v1/proxy/cw-fhir-proxy";

const router = Router();

router.use("/fhir", fhirProxy);

export default router;
