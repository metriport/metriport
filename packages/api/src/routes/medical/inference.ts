import { summarizeContext } from "@metriport/core/command/llm/inference/resource-summary";
import {
  defaultTemplateHandler,
  templateHandlersByResourceType,
} from "@metriport/core/command/llm/inference/prompts";
import { reportAdvancedMetrics } from "@metriport/core/external/aws/cloudwatch";
import { initTimer } from "@metriport/shared/common/timer";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import { z } from "zod";
import { handleParams } from "../helpers/handle-params";
import { requestLogger } from "../helpers/request-logger";
import { asyncHandler, getCxIdOrFail } from "../util";

const router = Router();

const resourceSummaryInferenceSchema = z.object({
  resourceType: z.string(),
  resourceDisplays: z.array(z.string()),
  resourceRowData: z.record(z.unknown()).optional(),
  context: z.string(),
  suspectsContext: z.string().optional(),
});

/** ---------------------------------------------------------------------------
 * POST /internal/inference/resource/summary
 *
 * Runs a Q&A style summary over some context surrounding a resource.
 * Returns a JSON response with the AI-generated summary.
 */
router.post(
  "/resource/summary",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const { resourceType, resourceDisplays, resourceRowData, context, suspectsContext } =
      resourceSummaryInferenceSchema.parse(req.body);
    console.log(`resourceType: ${resourceType}, resourceDisplays: ${resourceDisplays.join(", ")}`);

    const templateHandler = templateHandlersByResourceType[resourceType] ?? defaultTemplateHandler;

    // Build context based on resource type (handle suspectsContext)
    let finalContext = context;
    if (resourceType === "Suspects" && suspectsContext) {
      finalContext = `
## Suspect Analysis Context

The following FHIR resources were identified as responsible for creating this suspect:

${suspectsContext}

---

## Patient's Medical Record Context
${context}
`;
    }

    const customPromptSection = templateHandler({
      resourceType,
      resourceDisplays,
      resourceRowData,
    });

    const timer = initTimer();
    const result = await summarizeContext({
      resourceType,
      resourceDisplays,
      customPromptSection,
      context: finalContext,
      resourceRowData,
    });
    const duration = timer.getElapsedTime();
    console.log("Duration of request: ", duration);

    await reportAdvancedMetrics({
      service: "OSS API",
      metrics: [
        {
          name: "LLM.ResourceSummary.Duration",
          unit: "Milliseconds",
          value: duration,
          dimensions: {
            Customer: cxId,
          },
        },
        {
          name: "LLM.ResourceSummary.InputTokens",
          unit: "Count",
          value: result.inputTokens ?? 0,
          dimensions: {
            Customer: cxId,
          },
        },
        {
          name: "LLM.ResourceSummary.OutputTokens",
          unit: "Count",
          value: result.outputTokens ?? 0,
          dimensions: {
            Customer: cxId,
          },
        },
      ],
    });

    return res.status(status.OK).json({ summary: result.summary });
  })
);

export default router;
