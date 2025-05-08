import { Bundle, MetriportError, sleep } from "@metriport/shared";
import {
  FhirResource,
  SupportedResourceType,
  fhirResourceSchema,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import axios from "axios";
import { getConsolidated } from "../../../../../../../command/consolidated/consolidated-get";
import {
  FetchEhrBundleParams,
  fetchEhrBundlePreSignedUrls,
} from "../../../../../api/bundle/fetch-ehr-bundle-presigned-url";
import { setResourceDiffJobEntryStatus } from "../../../../../api/job/resource-diff-set-entry-status";
import { BundleType } from "../../../../bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../../command/update-bundle";
import { computeNewResources } from "../../utils";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesLocal implements EhrComputeResourceDiffBundlesHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiffBundles(payloads: ComputeResourceDiffBundlesRequest[]): Promise<void> {
    for (const payload of payloads) {
      const {
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        contribute = false,
        jobId,
        reportError = true,
      } = payload;
      const entryStatusParams = {
        ehr,
        cxId,
        practiceId,
        patientId: ehrPatientId,
        contribute,
        jobId,
      };
      try {
        const [metriportResources, ehrResources] = await Promise.all([
          getMetriportResourcesFromS3({
            cxId,
            patientId: metriportPatientId,
            resourceType,
          }),
          getEhrResourcesFromApi({
            ehr,
            cxId,
            practiceId,
            patientId: ehrPatientId,
            resourceType,
          }),
        ]);
        const { newEhrResources, newMetriportResources } = computeNewResources({
          ehrResources,
          metriportResources,
        });
        await Promise.all([
          newEhrResources.length > 0
            ? updateBundleOnS3({
                ehr,
                cxId,
                metriportPatientId,
                ehrPatientId,
                bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
                resources: newEhrResources,
                resourceType,
                jobId,
              })
            : undefined,
          newMetriportResources.length > 0
            ? updateBundleOnS3({
                ehr,
                cxId,
                metriportPatientId,
                ehrPatientId,
                bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
                resources: newMetriportResources,
                resourceType,
                jobId,
              })
            : undefined,
        ]);
        await setResourceDiffJobEntryStatus({ ...entryStatusParams, entryStatus: "successful" });
      } catch (error) {
        if (reportError) {
          await setResourceDiffJobEntryStatus({ ...entryStatusParams, entryStatus: "failed" });
        }
        throw error;
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getMetriportResourcesFromS3({
  cxId,
  patientId,
  resourceType,
}: {
  cxId: string;
  patientId: string;
  resourceType: SupportedResourceType;
}): Promise<FhirResource[]> {
  const consolidated = await getConsolidated({ cxId, patientId });
  const resources = consolidated?.bundle?.entry?.filter(
    entry => entry.resource?.resourceType === resourceType
  );
  if (!resources || resources.length < 1) return [];
  return resources.flatMap(entry => {
    if (!entry.resource) return [];
    const parsedResourceSafe = fhirResourceSchema.safeParse(entry.resource);
    if (!parsedResourceSafe.success) return [];
    return [parsedResourceSafe.data];
  });
}

async function getEhrResourcesFromApi({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: Omit<FetchEhrBundleParams, "refresh">): Promise<FhirResource[]> {
  const ehrResourcesBundle = await fetchEhrBundlePreSignedUrls({
    ehr,
    cxId,
    practiceId,
    patientId,
    resourceType,
  });
  const fetchedResourceType = ehrResourcesBundle.resourceTypes[0];
  const fetchedPreSignedUrls = ehrResourcesBundle.preSignedUrls[0];
  if (!fetchedResourceType || !fetchedPreSignedUrls) {
    throw new MetriportError("No resource type found in the EHR bundle", undefined, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
    });
  }
  const ehrResource = await axios.get(fetchedPreSignedUrls);
  const bundle: Bundle = ehrResource.data;
  return bundle.entry.map(entry => entry.resource);
}
