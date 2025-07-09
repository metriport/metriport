import { z } from "zod";

export const ffStringValuesSchema = z.object({
  enabled: z.boolean(),
  values: z.string().array(),
});
export type StringValuesFF = z.infer<typeof ffStringValuesSchema>;

export const ffBooleanSchema = z.object({
  enabled: z.boolean(),
});
export type BooleanFF = z.infer<typeof ffBooleanSchema>;

export const booleanFFsSchema = z.object({
  commonwellFeatureFlag: ffBooleanSchema,
  carequalityFeatureFlag: ffBooleanSchema,
});
export type BooleanFeatureFlags = z.infer<typeof booleanFFsSchema>;

export const cxBasedFFsSchema = z.object({
  cxsWithEnhancedCoverageFeatureFlag: ffStringValuesSchema,
  cxsWithCQDirectFeatureFlag: ffStringValuesSchema,
  cxsWithCWFeatureFlag: ffStringValuesSchema,
  cxsWithADHDMRFeatureFlag: ffStringValuesSchema,
  cxsWithNoMrLogoFeatureFlag: ffStringValuesSchema,
  cxsWithBmiMrFeatureFlag: ffStringValuesSchema,
  cxsWithDermMrFeatureFlag: ffStringValuesSchema,
  cxsWithAiBriefFeatureFlag: ffStringValuesSchema,
  getCxsWithCdaCustodianFeatureFlag: ffStringValuesSchema,
  cxsWithNoWebhookPongFeatureFlag: ffStringValuesSchema,
  cxsWithIncreasedSandboxLimitFeatureFlag: ffStringValuesSchema,
  cxsWithEpicEnabled: ffStringValuesSchema,
  cxsWithDemoAugEnabled: ffStringValuesSchema,
  cxsWithStalePatientUpdateEnabled: ffStringValuesSchema,
  cxsWithStrictMatchingAlgorithm: ffStringValuesSchema,
  cxsWithAthenaCustomFieldsEnabled: ffStringValuesSchema,
  cxsWithPcpVisitAiSummaryFeatureFlag: ffStringValuesSchema,
  cxsWithHl7NotificationWebhookFeatureFlag: ffStringValuesSchema,
  cxsWithDischargeSlackNotificationFeatureFlag: ffStringValuesSchema,
  cxsWithDischargeRequeryFeatureFlag: ffStringValuesSchema,
  cxsWithXmlRedownloadFeatureFlag: ffStringValuesSchema,
});
export type CxBasedFFsSchema = z.infer<typeof cxBasedFFsSchema>;

export const stringValueFFsSchema = cxBasedFFsSchema.merge(
  z.object({
    oidsWithIHEGatewayV2Enabled: ffStringValuesSchema,
    e2eCxIds: ffStringValuesSchema.nullish(),
  })
);
export type StringValueFeatureFlags = z.infer<typeof stringValueFFsSchema>;

export type CxFeatureFlagStatus = Partial<
  Record<keyof CxBasedFFsSchema, { cxInFFValues: boolean; ffEnabled: boolean }>
>;

export const ffDatastoreSchema = stringValueFFsSchema.merge(booleanFFsSchema);
export type FeatureFlagDatastore = z.infer<typeof ffDatastoreSchema>;
