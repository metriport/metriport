export type MedicalRecordsStatusDTO = {
  html: {
    exists: boolean;
    createdAt?: string;
  };
  pdf: {
    exists: boolean;
    createdAt?: string;
  };
};
