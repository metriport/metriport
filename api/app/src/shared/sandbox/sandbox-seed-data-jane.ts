import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

const s3Key = "jane.json";

export const janeDocRefs: DataEntry[] = [
  {
    s3Info: { bucket, key: s3Key },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTMzMDEzODgtQzk1RC00RkU2LTlCNzAtQTQ4MTZBMDM3NzVB",
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
