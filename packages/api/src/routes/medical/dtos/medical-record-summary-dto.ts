export type MedicalRecordsStatusDTO = {
  html: {
    exists: boolean;
    createdAt?: Date;
  };
  pdf: {
    exists: boolean;
    createdAt?: Date;
  };
};
