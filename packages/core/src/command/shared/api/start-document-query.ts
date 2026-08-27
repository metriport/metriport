import { internalDocumentQueryParamsSchema } from "@metriport/shared/interface/internal/document-query";
import axios from "axios";
import { z } from "zod";
import { disableWHMetadata } from "../../../domain/document-query/trigger-and-query";
import { Config } from "../../../util/config";
import { withDefaultApiErrorHandling } from "./shared";

export const startDocumentQueryParamsSchema = internalDocumentQueryParamsSchema.extend({
  context: z.string().optional(),
  disableWebhooks: z.boolean().optional(),
});

export type StartDocumentQueryParams = z.infer<typeof startDocumentQueryParamsSchema>;

/**
 * Starts the document query for a patient.
 *
 * @param cxId - The customer ID.
 * @param patientId - The patient ID.
 * @param requestId - The data pipeline request ID.
 * @param facilityId - The facility ID. Optional.
 * @param forceDownload - Whether to force download. Optional.
 * @param forcePatientDiscovery - Whether to force patient discovery. Optional.
 * @param cqManagingOrgName - The name of the managing organization. Optional.
 * @param triggerConsolidated - Whether to trigger consolidated to generate a PDF. Optional.
 * @param context - The context of the document query. Optional.
 * @param disableWebhooks - Whether to disable webhooks. Optional.
 */
export async function startDocumentQuery({
  cxId,
  patientId,
  requestId,
  facilityId,
  forceDownload,
  forcePatientDiscovery,
  cqManagingOrgName,
  triggerConsolidated,
  context = "default",
  disableWebhooks = false,
}: StartDocumentQueryParams): Promise<{
  requestId: string;
}> {
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const dqUrl = buildDocumentQueryUrl({
    cxId,
    patientId,
    facilityId,
    requestId,
    forceDownload,
    forcePatientDiscovery,
    cqManagingOrgName,
    triggerConsolidated,
  });
  const payload = disableWebhooks ? { metadata: disableWHMetadata } : {};

  const res = await withDefaultApiErrorHandling({
    functionToRun: () => api.post(dqUrl, payload),
    messageWhenItFails: `Failure while starting document query @ ${context}`,
    additionalInfo: {
      cxId,
      patientId,
      requestId,
      dqUrl,
      context: `${context}.startDocumentQuery`,
    },
  });

  return { requestId: res.data.requestId };
}

function buildDocumentQueryUrl({
  cxId,
  patientId,
  facilityId,
  requestId,
  forceDownload,
  forcePatientDiscovery,
  cqManagingOrgName,
  triggerConsolidated,
}: {
  cxId: string;
  patientId: string;
  facilityId?: string | undefined;
  requestId?: string | undefined;
  forceDownload?: boolean | undefined;
  forcePatientDiscovery?: boolean | undefined;
  cqManagingOrgName?: string | undefined;
  triggerConsolidated?: boolean | undefined;
}) {
  const urlParams = new URLSearchParams({
    cxId,
    patientId,
    ...(facilityId ? { facilityId } : {}),
    ...(requestId ? { requestId } : {}),
    ...(forceDownload !== undefined ? { forceDownload: forceDownload.toString() } : {}),
    ...(forcePatientDiscovery !== undefined
      ? { forcePatientDiscovery: forcePatientDiscovery.toString() }
      : {}),
    ...(cqManagingOrgName ? { cqManagingOrgName } : {}),
    ...(triggerConsolidated !== undefined
      ? { triggerConsolidated: triggerConsolidated.toString() }
      : {}),
  });
  return `/internal/docs/query?${urlParams.toString()}`;
}
