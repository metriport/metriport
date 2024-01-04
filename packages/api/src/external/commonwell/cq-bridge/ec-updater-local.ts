import {
  ECUpdater,
  StoreECAfterDocQueryCmd,
  StoreECAfterIncludeListCmd,
} from "@metriport/core/external/commonwell/cq-bridge/ec-updater";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import NotFoundError from "@metriport/core/util/error/not-found";
import { CoverageEnhancementModel } from "../../../models/medical/coverage-enhancement";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { createOrUpdateCoverageEnhancements } from "./coverage-enhancement-storage";

export class ECUpdaterLocal extends ECUpdater {
  async storeECAfterIncludeList({
    ecId,
    cxId,
    patientIds,
    cqOrgIds,
  }: StoreECAfterIncludeListCmd): Promise<void> {
    await executeAsynchronously(
      patientIds,
      async patientId => {
        await executeOnDBTx(CoverageEnhancementModel.prototype, async transaction => {
          const existing = await CoverageEnhancementModel.findOne({
            where: {
              ecId,
              patientId,
            },
            transaction,
          });
          if (existing && existing.cxId !== cxId) {
            throw new MetriportError(`CxId mismatch`, undefined, {
              paramCxId: cxId,
              loadedCxId: existing.cxId,
              patientId,
              cqOrgIds: cqOrgIds.join(","),
            });
          }
          const updatedCQList = [...(existing?.data.cqOrgIds ?? []), ...cqOrgIds];
          const ecList = patientIds.map(patientId => ({
            ecId,
            cxId,
            patientId,
            data: {
              ...(existing?.data ?? {}),
              cqOrgIds: updatedCQList,
            },
          }));
          await createOrUpdateCoverageEnhancements(ecList, transaction);
        });
      },
      { numberOfParallelExecutions: 20 }
    );
  }

  async storeECAfterDocQuery({
    ecId,
    cxId,
    patientId,
    docsFound,
  }: StoreECAfterDocQueryCmd): Promise<void> {
    await executeOnDBTx(CoverageEnhancementModel.prototype, async transaction => {
      const existing = await CoverageEnhancementModel.findOne({
        where: {
          ecId,
          patientId,
        },
        transaction,
      });
      if (!existing) {
        throw new NotFoundError(`Coverage enhancement not found`, undefined, {
          cxId,
          patientId,
          docsFound,
        });
      }
      if (existing.cxId !== cxId) {
        throw new MetriportError(`CxId mismatch`, undefined, {
          paramCxId: cxId,
          loadedCxId: existing.cxId,
          patientId,
          docsFound,
        });
      }
      await createOrUpdateCoverageEnhancements(
        [
          {
            ecId,
            cxId,
            patientId,
            data: {
              ...existing.data,
              docsFound,
            },
          },
        ],
        transaction
      );
    });
  }
}
