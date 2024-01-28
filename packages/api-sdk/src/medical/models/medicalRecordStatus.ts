export type MedicalRecordsStatus = {
  html: {
    exists: boolean;
    createdAt?: Date;
  };
  pdf: {
    exists: boolean;
    createdAt?: Date;
  };
};
