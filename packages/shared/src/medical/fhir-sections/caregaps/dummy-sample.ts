export type CareGap = {
  id: string;
  resourceType: "CareGap";
  name: string;
  description: string;
  code: string;
  system: string;
};

export const exampleCareGaps: CareGap[] = [
  {
    id: "a207be85-02d9-761a-9c8b-6224a053ca31",
    resourceType: "CareGap",
    name: "Eye Exam With Evidence of Retinopathy",
    code: "2022F",
    description:
      "Dilated retinal eye exam with interpretation by an ophthalmologist or optometrist documented and reviewed; with evidence of retinopathy (DM)",
    system: "CPT-CAT-II",
  },
];
