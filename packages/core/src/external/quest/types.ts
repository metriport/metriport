export type QuestRosterPatient = {
  cxId: string;
  patientId: string;
};

export type QuestRosterResult = {
  rosterFileName: string;
  rosterContent: Buffer;
  patients: QuestRosterPatient[];
};
