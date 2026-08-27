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
  commonwellLogsEnabled: ffBooleanSchema,
  commonwellNewDocumentIdFormatEnabled: ffBooleanSchema,
  carequalityFeatureFlag: ffBooleanSchema,
  cqDoaFeatureFlag: ffBooleanSchema,
  debugFeatureFlag: ffBooleanSchema,
  ehexEnabled: ffBooleanSchema,
  ehexTargetedQueriesEnabled: ffBooleanSchema,
});
export type BooleanFeatureFlags = z.infer<typeof booleanFFsSchema>;

export const cxBasedFFsSchema = z.object({
  cxsWithCQDirectFeatureFlag: ffStringValuesSchema,
  cxsWithEhexEnabled: ffStringValuesSchema,
  cxsWithCWFeatureFlag: ffStringValuesSchema,
  cxsWithADHDMRFeatureFlag: ffStringValuesSchema,
  cxsWithNoMrLogoFeatureFlag: ffStringValuesSchema,
  cxsWithBmiMrFeatureFlag: ffStringValuesSchema,
  cxsWithSimpleMrFeatureFlag: ffStringValuesSchema,
  cxsWithDermMrFeatureFlag: ffStringValuesSchema,
  cxsWithAiBriefFeatureFlag: ffStringValuesSchema,
  cxsWithAiBriefV2FeatureFlag: ffStringValuesSchema,
  cxsWithSurescriptsFeatureFlag: ffStringValuesSchema,
  cxsWithSurescriptsNotificationsFeatureFlag: ffStringValuesSchema,
  cxsWithQuestFeatureFlag: ffStringValuesSchema,
  getCxsWithCdaCustodianFeatureFlag: ffStringValuesSchema,
  cxsWithNoWebhookPongFeatureFlag: ffStringValuesSchema,
  cxsWithIncreasedSandboxLimitFeatureFlag: ffStringValuesSchema,
  cxsWithEpicEnabled: ffStringValuesSchema,
  cxsWithDemoAugEnabled: ffStringValuesSchema,
  cxsWithStrictMatchingAlgorithm: ffStringValuesSchema,
  cxsWithAthenaCustomFieldsEnabled: ffStringValuesSchema,
  cxsWithEnrichedPatientDemographicsFeatureFlag: ffStringValuesSchema,
  cxsWithPcpVisitAiSummaryFeatureFlag: ffStringValuesSchema,
  cxsWithRecentVisitAiSummary: ffStringValuesSchema,
  cxsWithCardiacCareAiSummary: ffStringValuesSchema,
  cxsWithCardiacCareV2AiSummary: ffStringValuesSchema,
  cxsWithNitratesAndConditionsAiSummary: ffStringValuesSchema,
  cxsWithDischargeSlackNotificationFeatureFlag: ffStringValuesSchema,
  cxsWithDischargeRequeryFeatureFlag: ffStringValuesSchema,
  cxsWithXmlRedownloadFeatureFlag: ffStringValuesSchema,
  cxsWithAnalyticsIncrementalIngestion: ffStringValuesSchema.optional(),
  cxsWithAnalyticsIncrementalRawToCore: ffStringValuesSchema.optional(),
  cxsWithDatawarehouseSnowflake: ffStringValuesSchema.optional(),
  cxsWithNewSoapEnvelopeFeatureFlag: ffStringValuesSchema,
  cxsWithAdtsRosterUploadEnabledFeatureFlag: ffStringValuesSchema,
  cxsWithAdtsDataVisibleEnabledFeatureFlag: ffStringValuesSchema,
  cxsWithDashV2FeatureFlag: ffStringValuesSchema,
  cxsWithLegacyDashV1FeatureFlag: ffStringValuesSchema,
  cxsWithSendAdtToCanvasFeatureFlag: ffStringValuesSchema,
  cxsWithEhexMaxParticipantCountBypassEnabled: ffStringValuesSchema,
  cxsWithHydrateConditionCodeByDisplayFeatureFlag: ffStringValuesSchema,
});
export type CxBasedFFsSchema = z.infer<typeof cxBasedFFsSchema>;

export const stringValueFFsSchema = cxBasedFFsSchema.merge(
  z.object({
    e2eCxIds: ffStringValuesSchema.nullish(),
  })
);
export type StringValueFeatureFlags = z.infer<typeof stringValueFFsSchema>;

export type CxFeatureFlagStatus = Partial<
  Record<keyof CxBasedFFsSchema, { cxInFFValues: boolean; ffEnabled: boolean }>
>;

export const ffDatastoreSchema = stringValueFFsSchema.merge(booleanFFsSchema);
export type FeatureFlagDatastore = z.infer<typeof ffDatastoreSchema>;

export const frontendIntendedFFsSchema = cxBasedFFsSchema.pick({
  cxsWithDashV2FeatureFlag: true,
  cxsWithLegacyDashV1FeatureFlag: true,
});
export type FrontendIntendedFFs = z.infer<typeof frontendIntendedFFsSchema>;
export type FrontendIntendedReadableFlagNames = "shouldShowDashV2" | "shouldShowLegacyDashV1";
export type CxFeatureFlagsResponse = Partial<
  Record<keyof FrontendIntendedFFs | FrontendIntendedReadableFlagNames, true>
>;
