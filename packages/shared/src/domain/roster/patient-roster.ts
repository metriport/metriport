import { CreateRosterCmd, GetRosterCmd, ListRostersCmd, Roster } from "./roster";

export type PatientRoster = {
  id: string;
  patientId: string;
  rosterId: string;
};

export type AssignOrRemovePatientsToRosterCmd = Pick<GetRosterCmd, "rosterId" | "cxId"> & {
  patientIds?: string[];
  allPatients?: boolean;
  overrideClose?: boolean;
};

export type AssignPatientsAndCreateRosterCmd = Omit<AssignOrRemovePatientsToRosterCmd, "rosterId"> &
  Omit<CreateRosterCmd, "cxId" | "status">;

export type ListRostersForPatientCmd = ListRostersCmd & {
  patientId: string;
};

export type AssignPatientsToRosterResponse = {
  count: number;
  roster: Roster;
};
