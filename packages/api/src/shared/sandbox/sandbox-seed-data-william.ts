import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const williamDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "william1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBQUEtQkJCQi1DQ0NDLUREREQtRUVFRUVFRUVFRUVF",
      content: [
        {
          attachment: {
            title: "william1.xml",
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
      key: "william11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMTEtQkIxMS1DQzExLUREMTEtRUVFRUVFRUVFRTEx",
      content: [
        {
          attachment: {
            title: "william11.pdf",
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
      key: "william12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMTItQkIxMi1DQzEyLUREMTItRUVFRUVFRUVFRTEy",
      content: [
        {
          attachment: {
            title: "william12.pdf",
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
      key: "william13.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMTMtQkIxMy1DQzEzLUREMTMtRUVFRUVFRUVFRTEz",
      content: [
        {
          attachment: {
            title: "william13.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
