import { Router } from "express";
import fhirProxy from "./fhir-proxy";

const router = Router();

router.use("/fhir", fhirProxy);

export default router;
