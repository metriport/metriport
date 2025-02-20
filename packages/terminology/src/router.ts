import { FhirRequest, HttpMethod } from "@medplum/fhir-router";
import { Request, Response, Router } from "express";
import { codeSystemImportHandler } from "./operations/codeImport";
import { bulkCodeSystemLookupHandler, codeSystemLookupHandler } from "./operations/codeLookup";
import { conceptMapImportHandler } from "./operations/conceptMapImport";
import { conceptMapTranslateHandler } from "./operations/conceptMapTranslate";
import { asyncHandler } from "./util";

const fhirRouter = Router();

function parseIntoFhirRequest(req: Request): FhirRequest {
  return {
    method: req.method as HttpMethod,
    pathname: req.originalUrl.replace("/fhir/R4", "").split("?").shift() || "",
    params: req.params,
    query: req.query as Record<string, string>,
    body: req.body,
    headers: req.headers,
  };
}

fhirRouter.post(
  "/code-system/import",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    const response = await codeSystemImportHandler(fhirRequest);
    res.status(200).json(response);
    return;
  })
);

fhirRouter.post(
  "/code-system/lookup",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    const response = await codeSystemLookupHandler(fhirRequest, false);
    res.status(200).json({ response });
    return;
  })
);

fhirRouter.post(
  "/code-system/lookup/bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    console.log("Received bulk request body:", JSON.stringify(fhirRequest.body));
    const response = await bulkCodeSystemLookupHandler(fhirRequest);
    return res.status(response.status).json(response.data);
  })
);

fhirRouter.post(
  "/code-system/lookup/partial",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    const response = await codeSystemLookupHandler(fhirRequest, true);
    res.status(200).json({ response });
    return;
  })
);

fhirRouter.post(
  "/concept-map/import",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    const response = await conceptMapImportHandler(fhirRequest);
    res.status(200).json({ response });
    return;
  })
);

fhirRouter.post(
  "/concept-map/translate",
  asyncHandler(async (req: Request, res: Response) => {
    const fhirRequest = parseIntoFhirRequest(req);
    const response = await conceptMapTranslateHandler(fhirRequest);
    res.status(200).json({ response });
    return;
  })
);

export { fhirRouter };
