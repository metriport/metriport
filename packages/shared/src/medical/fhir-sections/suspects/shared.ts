export type Suspect = {
  id: string;
  resourceType: "Suspect";
  condition: string;
  code: string;
  documented: string;
};

export const exampleSuspects: Suspect[] = [
  {
    id: "suspect-1",
    resourceType: "Suspect",
    condition: "Diabetes Mellitus",
    code: "ICD-10: Z71.1",
    documented: "2023-10-15",
  },
  {
    id: "suspect-2",
    resourceType: "Suspect",
    condition: "Cardiovascular Condition",
    code: "ICD-10: Z03.89",
    documented: "2023-09-22",
  },
  {
    id: "suspect-3",
    resourceType: "Suspect",
    condition: "Endocrine Disorder",
    code: "ICD-10: Z03.9",
    documented: "2023-11-03",
  },
];
