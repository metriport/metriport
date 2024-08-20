import { Router, Request, Response } from "express";
import { codeSystemImportHandler } from "./operations/codeImport";
import { codeSystemLookupHandler } from "./operations/codeLookup";
import { conceptMapImportHandler } from "./operations/conceptMapImport";
import { conceptMapTranslateHandler } from "./operations/conceptMapTranslate";
import { FhirRequest, HttpMethod } from "@medplum/fhir-router";

const fhirRouter = Router();

function createFhirRequest(req: Request): FhirRequest {
  return {
    method: req.method as HttpMethod,
    pathname: req.originalUrl.replace("/fhir/R4", "").split("?").shift() || "",
    params: req.params,
    query: req.query as Record<string, string>,
    body: req.body,
    headers: req.headers,
  };
}

fhirRouter.post("/CodeSystem/import", async (req: Request, res: Response) => {
  const fhirRequest = createFhirRequest(req);
  const response = await codeSystemImportHandler(fhirRequest);
  res.status(200).json(response);
});

fhirRouter.post("/CodeSystem/lookup", async (req: Request, res: Response) => {
  const fhirRequest = createFhirRequest(req);
  const response = await codeSystemLookupHandler(fhirRequest, false);
  res.status(200).json(response);
});

fhirRouter.post("/CodeSystem/lookup/partial", async (req: Request, res: Response) => {
  const fhirRequest = createFhirRequest(req);
  const response = await codeSystemLookupHandler(fhirRequest, true);
  res.status(200).json(response);
});

fhirRouter.post("/ConceptMap/import", async (req: Request, res: Response) => {
  const fhirRequest = createFhirRequest(req);
  const response = await conceptMapImportHandler(fhirRequest);
  res.status(200).json(response);
});

fhirRouter.post("/ConceptMap/translate", async (req: Request, res: Response) => {
  const fhirRequest = createFhirRequest(req);
  const response = await conceptMapTranslateHandler(fhirRequest);
  res.status(200).json(response);
});

export { fhirRouter };
