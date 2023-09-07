import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const emiliaDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "emelia1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMzAtQkIzMC1DQzMwLUREMzAtRUVFRUVFRUVFRTMw",
      content: [
        {
          attachment: {
            title: "emelia1.xml",
            url: "http://api.metriport.com",
            contentType: "application/xml",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "emelia11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBNDAtQkI0MC1DQzQwLURENDAtRUVFRUVFRUVFRTQw",
      content: [
        {
          attachment: {
            title: "emelia11.pdf",
            url: "http://api.metriport.com",
            contentType: "application/pdf",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "emelia12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBNDEtQkI0MS1DQzQxLURENDEtRUVFRUVFRUVFRTQx",
      content: [
        {
          attachment: {
            title: "emelia12.pdf",
            url: "http://api.metriport.com",
            contentType: "application/pdf",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "emelia13.png",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBNDItQkI0Mi1DQzQyLURENDItRUVFRUVFRUVFRTQy",
      content: [
        {
          attachment: {
            title: "emelia13.png",
            url: "http://api.metriport.com",
            contentType: "image/png",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "emelia14.png",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBNDMtQkI0My1DQzQzLURENDMtRUVFRUVFRUVFRTQz",
      content: [
        {
          attachment: {
            title: "emelia14.png",
            url: "http://api.metriport.com",
            contentType: "image/png",
          },
        },
      ],
    },
  },
];
