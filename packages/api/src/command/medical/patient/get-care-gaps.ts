import { NotFoundError } from "@metriport/shared";
import { CareGap } from "@metriport/shared/src/domain/care-gap";
import { CareGapModel } from "../../../models/care-gap";

export type GetCareGapParams = {
  cxId: string;
  patientId: string;
  measureName: string;
};

export async function getCareGap({
  cxId,
  patientId,
  measureName,
}: GetCareGapParams): Promise<CareGap | undefined> {
  const existing = await CareGapModel.findOne({ where: { cxId, patientId, measureName } });
  if (existing) return existing.dataValues;
  return undefined;
}

export async function getCareGapOrFail({
  cxId,
  patientId,
  measureName,
}: GetCareGapParams): Promise<CareGap> {
  const careGap = await getCareGap({ cxId, patientId, measureName });
  if (!careGap) {
    throw new NotFoundError("Care gap not found", undefined, { cxId, patientId, measureName });
  }
  return careGap;
}

export async function getLatestCareGapsByMeasure({
  cxId,
  patientId,
}: Omit<GetCareGapParams, "measureName">): Promise<CareGap[]> {
  const careGaps = await CareGapModel.findAll({
    where: { cxId, patientId },
    order: [
      ["measureName", "ASC"],
      ["jobId", "DESC"],
      ["lastRun", "DESC"],
    ],
  });

  if (!careGaps.length) return [];

  const latestByMeasure = careGaps.reduce((acc, careGap) => {
    const measureName = careGap.measureName;
    if (!acc[measureName]) {
      acc[measureName] = careGap.dataValues;
    }
    return acc;
  }, {} as Record<string, CareGap>);

  return Object.values(latestByMeasure);
}
