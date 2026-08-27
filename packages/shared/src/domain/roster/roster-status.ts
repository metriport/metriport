import { BadRequestError } from "../../error/bad-request";

export const rosterStatus = ["open", "closed"] as const;
export type RosterStatus = (typeof rosterStatus)[number];

export function isValidRosterStatus(status: string): status is RosterStatus {
  return rosterStatus.includes(status as RosterStatus);
}

export const rosterInitialStatus: RosterStatus = "open";

export function isRosterOpen(status: RosterStatus): boolean {
  return status === "open";
}

export function isRosterClosed(status: RosterStatus): boolean {
  return status === "closed";
}

/**
 * Validates that a new status is valid based on the current status.
 *
 * @param currentStatus - The current status of the roster.
 * @param newStatus - The new status to validate.
 * @returns The validated new status.
 * @throws BadRequestError if the new status is not valid.
 */
export function validateNewRosterStatus(
  currentStatus: RosterStatus,
  newStatus: RosterStatus
): RosterStatus {
  const additionalInfo = {
    currentStatus,
    newStatus,
  };
  switch (newStatus) {
    case "open":
      if (currentStatus !== "open") {
        throw new BadRequestError(
          `Roster is not open, cannot update to open`,
          undefined,
          additionalInfo
        );
      }
      break;
    case "closed":
      if (currentStatus !== "open" && currentStatus !== "closed") {
        throw new BadRequestError(
          `Roster is not in a valid state to update to closed`,
          undefined,
          additionalInfo
        );
      }
      break;
    default:
      throw new BadRequestError(`Invalid roster status`, undefined, additionalInfo);
  }
  return newStatus;
}
