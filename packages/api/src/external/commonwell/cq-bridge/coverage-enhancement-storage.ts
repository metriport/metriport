import { Transaction } from "sequelize";
import { CoverageEnhancementUpdate } from "../../../domain/medical/coverage-enhancement";
import { CoverageEnhancementModel } from "../../../models/medical/coverage-enhancement";

export type CreateOrUpdateCmd = CoverageEnhancementUpdate[];

export const createOrUpdateCoverageEnhancements = async (
  ecList: CreateOrUpdateCmd,
  transaction?: Transaction
): Promise<void> => {
  // create or update
  await CoverageEnhancementModel.bulkCreate(ecList, {
    returning: false,
    updateOnDuplicate: ["data"],
    transaction,
  });
};
