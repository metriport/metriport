import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

const s3Key = "heather.json";

export const heatherDocRefs: DataEntry[] = [
  {
    s3Info: { bucket, key: s3Key },
    docRef: {
      resourceType: "DocumentReference",
      id: "MWFkNWZkNTUtNmRiMC00MTg4LTkyZTQtNzBjYjRjYTc2NDFl",
      content: [
        {
          attachment: {
            title: s3Key,
            url: "http://api.metriport.com",
          },
        },
      ],
    },
  },
];
