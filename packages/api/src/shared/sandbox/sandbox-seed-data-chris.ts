import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const chrisDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "ChrisSmith.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MmVlN2I2MzAtNjdhNC00ZThiLTgwOWQtNjkyNjk0Y2FiOTM3",
      content: [
        {
          attachment: {
            title: "ChrisSmith.xml",
            url: "http://api.metriport.com",
            contentType: "application/xml",
            creation: "2023-06-16",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo2.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZDQ4NzYwOGMtYTRkMi00NjI5LTk0ZGQtMGMwMzFhMGUyZmZm",
      content: [
        {
          attachment: {
            title: "demo2.pdf",
            url: "http://api.metriport.com",
            contentType: "application/pdf",
            creation: "2017-10-03",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo3.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MzA2ODcxMTQtZjc0YS00MTY2LWJiMjEtMTY3ZjYwYmQ4ODBi",
      content: [
        {
          attachment: {
            title: "demo3.pdf",
            url: "http://api.metriport.com",
            contentType: "application/pdf",
            creation: "2018-12-20",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo4.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NjQ5N2YzZDUtOTQ4Yy00YjA2LTk3N2MtMDg2MjViMzExNzM1",
      content: [
        {
          attachment: {
            title: "demo4.pdf",
            url: "http://api.metriport.com",
            contentType: "application/pdf",
            creation: "2019-06-30",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo5.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MmEwZTU1OGItMjhjNC00YTgyLTlhMWYtNDAwOGU2OTAxODcw",
      content: [
        {
          attachment: {
            title: "demo5.jpeg",
            url: "http://api.metriport.com",
            contentType: "image/jpeg",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo6.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "N2NhYmE4NzEtYjc5Zi00NWJhLWE3MDItNzM0Mjk5ODBiZmY4",
      content: [
        {
          attachment: {
            title: "demo6.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "demo7.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OGNiNTdhNmQtYmI4NS00NTZjLWJmYTQtZDU5ZWU1ZDhkOWI1",
      content: [
        {
          attachment: {
            title: "demo7.jpeg",
            url: "http://api.metriport.com",
            contentType: "image/jpeg",
          },
        },
      ],
    },
  },
];
