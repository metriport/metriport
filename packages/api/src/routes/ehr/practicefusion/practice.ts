import { buildDayjs } from "@metriport/shared/common/date";
import { PracticeFusionSecondaryMappings } from "@metriport/shared/interface/external/ehr/practicefusion/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Request, Response } from "express";
import Router from "express-promise-router";
import httpStatus from "http-status";
import { getCxMappingAndParsedSecondaryMappings } from "../../../external/ehr/shared/command/mapping/get-cx-mapping-and-secondary-mappings";
import { handleParams } from "../../helpers/handle-params";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getCxIdOrFail, getFromQueryOrFail } from "../../util";
import { setSecondaryMappingsOnCxMappingById } from "../../../command/mapping/cx";

const router = Router();

/**
 * GET /ehr/practicefusion/practice/terms-of-service
 *
 * Check if practice accepted Terms of Service
 * @returns True if accepted TOS else false.
 */
router.get(
  "/terms-of-service",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const practiceFusionPracticeId = getFromQueryOrFail("practiceId", req);
    const { parsedSecondaryMappings } =
      await getCxMappingAndParsedSecondaryMappings<PracticeFusionSecondaryMappings>({
        ehr: EhrSources.practicefusion,
        practiceId: practiceFusionPracticeId,
      });
    if (parsedSecondaryMappings.acceptedTermsOfServiceTimestamp) {
      return res.status(httpStatus.OK).json({
        isTermsOfServiceAccepted: true,
      });
    }
    return res.status(httpStatus.OK).json({
      isTermsOfServiceAccepted: false,
    });
  })
);

/**
 * POST /ehr/practicefusion/practice/terms-of-service
 *
 * Accept Terms of Service
 * @returns HTTP 200 OK on successful processing.
 */
router.post(
  "/terms-of-service",
  handleParams,
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getCxIdOrFail(req);
    const practiceFusionPracticeId = getFromQueryOrFail("practiceId", req);
    const { parsedSecondaryMappings, cxMapping } =
      await getCxMappingAndParsedSecondaryMappings<PracticeFusionSecondaryMappings>({
        ehr: EhrSources.practicefusion,
        practiceId: practiceFusionPracticeId,
      });
    if (parsedSecondaryMappings.acceptedTermsOfServiceTimestamp) {
      return res.sendStatus(httpStatus.OK);
    }
    await setSecondaryMappingsOnCxMappingById({
      cxId,
      id: cxMapping.id,
      secondaryMappings: {
        ...parsedSecondaryMappings,
        acceptedTermsOfServiceTimestamp: buildDayjs().toISOString(),
      },
    });
    return res.sendStatus(httpStatus.OK);
  })
);

export default router;
