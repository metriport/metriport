import { StartConsolidatedQueryProgressResponse } from "@metriport/api-sdk/medical/models/patient";
import { consolidationConversionType } from "@metriport/core/domain/conversion/fhir-to-medical-record";
import { capture, out } from "@metriport/core/util";
import { z } from "zod";
import { startConsolidatedQuery } from "../../../command/medical/patient/consolidated-get";
import BadRequestError from "../../../errors/bad-request";
import { isAiBriefEnabledForCx } from "../../../external/aws/app-config";
import { ConsolidatedQueryParams } from "./consolidated-get";

const consolidationConversionTypeSchema = z.enum(consolidationConversionType);

type ConsolidatedPost = {
  type: string | undefined;
  generateAiBrief: boolean;
  cxConsolidatedRequestMetadata: {
    metadata?: Record<string, string> | undefined;
  };
} & ConsolidatedQueryParams;

export async function processConsolidatedQuery({
  cxId,
  patientId,
  resources,
  dateFrom,
  dateTo,
  generateAiBrief,
  type,
  cxConsolidatedRequestMetadata,
}: ConsolidatedPost): Promise<StartConsolidatedQueryProgressResponse> {
  await checkAiBriefEnabled({ cxId, generateAiBrief });

  const conversionType = type ? consolidationConversionTypeSchema.parse(type) : undefined;

  return startConsolidatedQuery({
    cxId,
    patientId,
    resources,
    dateFrom,
    dateTo,
    conversionType,
    cxConsolidatedRequestMetadata: cxConsolidatedRequestMetadata?.metadata,
    generateAiBrief,
  });
}

async function checkAiBriefEnabled({
  cxId,
  generateAiBrief,
}: {
  cxId: string;
  generateAiBrief: boolean;
}): Promise<void> {
  const { log } = out(`AI Brief for cxId: ${cxId}`);
  if (!generateAiBrief) return;

  const isAiBriefFeatureFlagEnabled = await isAiBriefEnabledForCx(cxId);
  if (!isAiBriefFeatureFlagEnabled && generateAiBrief) {
    const msg = `CX requires AI Brief feature`;
    log(msg);
    capture.message(msg, {
      extra: {
        cxId,
        generateAiBrief,
        isAiBriefFeatureFlagEnabled,
      },
      level: "info",
    });
    throw new BadRequestError("Contact Metriport to enable the AI Brief feature.");
  }
}
