import { Resource } from "@medplum/fhirtypes";
import { BadRequestError, errorToString, NotFoundError, sleep } from "@metriport/shared";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { setJobEntryStatus } from "../../../../../../command/job/patient/api/set-entry-status";
import { executeAsynchronously } from "../../../../../../util/concurrency";
import { log } from "../../../../../../util/log";
import { capture } from "../../../../../../util/notifications";
import { BundleType } from "../../../../bundle/bundle-shared";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { writeBackResource } from "../../../../command/write-back/shared";
import {
  EhrWriteBackResourceDiffBundlesHandler,
  EhrWriteBackResourceDiffBundlesRequest,
} from "./ehr-write-back-resource-diff-bundles";

dayjs.extend(duration);

const parallelRequests = 5;
const delayBetweenRequestBatches = dayjs.duration(2, "seconds");

export class EhrWriteBackResourceDiffBundlesDirect
  implements EhrWriteBackResourceDiffBundlesHandler
{
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async writeBackResourceDiffBundles(
    payload: EhrWriteBackResourceDiffBundlesRequest
  ): Promise<void> {
    const {
      ehr,
      tokenId,
      cxId,
      practiceId,
      metriportPatientId,
      ehrPatientId,
      resourceType,
      jobId,
      reportError = true,
    } = payload;
    const entryStatusParams = {
      ehr,
      cxId,
      practiceId,
      patientId: ehrPatientId,
      jobId,
    };
    try {
      const metriportOnlyResources = await getMetriportOnlyResourcesFromS3({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        jobId,
      });
      if (metriportOnlyResources.length < 1) {
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "successful",
        });
        return;
      }
      await writeBackMetriportOnlyResources({
        ehr,
        tokenId,
        cxId,
        practiceId,
        ehrPatientId,
        metriportOnlyResources,
      });
      await setJobEntryStatus({
        ...entryStatusParams,
        entryStatus: "successful",
      });
    } catch (error) {
      if (reportError) {
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "failed",
        });
      }
      throw error;
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getMetriportOnlyResourcesFromS3({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
}: Omit<FetchBundleParams, "bundleType">): Promise<Resource[]> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
    jobId,
  });
  if (!bundle?.bundle.entry || bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function writeBackMetriportOnlyResources({
  ehr,
  tokenId,
  cxId,
  practiceId,
  ehrPatientId,
  metriportOnlyResources,
}: {
  ehr: EhrSource;
  tokenId: string | undefined;
  cxId: string;
  practiceId: string;
  ehrPatientId: string;
  metriportOnlyResources: Resource[];
}): Promise<void> {
  const writeBackErrors: { error: unknown; resource: Resource }[] = [];
  await executeAsynchronously(
    metriportOnlyResources,
    async resource => {
      try {
        await writeBackResource({
          ehr,
          ...(tokenId && { tokenId }),
          cxId,
          practiceId,
          ehrPatientId,
          resource,
        });
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) return;
        const resourceToString = JSON.stringify(resource);
        log(`Failed to write back resource ${resourceToString}. Cause: ${errorToString(error)}`);
        writeBackErrors.push({ error, resource });
      }
    },
    {
      numberOfParallelExecutions: parallelRequests,
      delay: delayBetweenRequestBatches.asMilliseconds(),
    }
  );
  if (writeBackErrors.length > 0) {
    const msg = `Failure while writing back some resources @ EHR`;
    capture.message(msg, {
      extra: {
        writeBackArgsCount: metriportOnlyResources.length,
        writeBackErrorsCount: writeBackErrors.length,
        errors: writeBackErrors,
        context: "create-resource-diff-bundles.write-back.writeBackMetriportOnlyResources",
      },
    });
  }
}
