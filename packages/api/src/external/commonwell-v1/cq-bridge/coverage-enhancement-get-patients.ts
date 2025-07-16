import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Op } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { CQLinkStatus } from "../patient-shared";

dayjs.extend(duration);

// To avoid processing patients that haven't finished being sync'ed @ CW
const MIN_TIME_AFTER_PATIENT_CREATED = dayjs.duration({ minutes: 2 });

export type PatientToLink = {
  cxId: string;
  id: string;
};

/**
 * Get the list of patients to have coverage enhanced through link with CareQuality Orgs.
 */
export async function getPatientsToEnhanceCoverage(cxIds: string[]): Promise<PatientToLink[]> {
  const earliestDate = dayjs()
    .subtract(MIN_TIME_AFTER_PATIENT_CREATED.asMilliseconds(), "milliseconds")
    .toDate();
  const cqLinkStatusNotToLink: CQLinkStatus[] = ["linked", "processing"];
  const attributesToQuery: (keyof PatientToLink)[] = ["id", "cxId"];
  const patientsWithIds = await PatientModel.findAll({
    attributes: attributesToQuery,
    where: {
      ...(cxIds.length ? { cxId: { [Op.in]: cxIds } } : {}),
      data: {
        externalData: {
          COMMONWELL: {
            cqLinkStatus: {
              // Intentionally not returning records with `null` b/c we don't want to process
              // those that were already processed before this has been released - new ones
              // gave status `unlinked` by default.
              [Op.notIn]: cqLinkStatusNotToLink,
            },
          },
        },
      },
      createdAt: { [Op.lte]: earliestDate },
    },
  });
  return patientsWithIds.map(p => ({ cxId: p.cxId, id: p.id }));
}
