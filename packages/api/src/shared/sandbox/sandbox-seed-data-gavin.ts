import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const gavinDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "gavin1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YzYwZjlhMGYtZDUwZS00YzU5LTgwNmEtOWJiNzEyM2ExNDZl",
      content: [
        {
          attachment: {
            title: "gavin1.xml",
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
      key: "gavin11.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZTljMmVmNDQtMjgxMi00ZmUxLTlkMTgtMGVjYmI5YmVjOWYx",
      content: [
        {
          attachment: {
            title: "gavin11.tif",
            url: "http://api.metriport.com",
            contentType: "application/tif",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "gavin12.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OGMwZTJhNDUtNDA2MS00YThhLTg1ZGYtYjNjNGRkYWEwZTk4",
      content: [
        {
          attachment: {
            title: "gavin12.jpeg",
            url: "http://api.metriport.com",
            contentType: "application/jpeg",
          },
        },
      ],
    },
  },
];
