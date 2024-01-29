export type MedicalRecordsStatus = {
  html: {
    exists: boolean;
    createdAt?: string;
  };
  pdf: {
    exists: boolean;
    createdAt?: string;
  };
};
