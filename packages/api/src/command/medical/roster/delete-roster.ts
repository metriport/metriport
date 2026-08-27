import { BadRequestError, DeleteRosterCmd, NotFoundError } from "@metriport/shared";
import { RosterModel } from "../../../models/medical/roster";
import { getRosterSize } from "./patient-roster/get-roster-size";

export async function deleteRoster({ rosterId, cxId }: DeleteRosterCmd): Promise<void> {
  const size = await getRosterSize({ rosterId, cxId });
  if (size > 0) {
    throw new BadRequestError(`Roster is not empty`, undefined, {
      rosterId,
      cxId,
      size,
    });
  }
  const deletedCount = await RosterModel.destroy({ where: { id: rosterId, cxId } });
  if (deletedCount < 1) {
    throw new NotFoundError(`Could not find roster for deletion`, undefined, { rosterId, cxId });
  }
}
