import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const janeDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "JaneSmith.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YmNmY2I2YmEtOWI0OC00MjQwLWE4NmItMTZjYjg3MGQwMzM5",
      content: [
        {
          attachment: {
            title: "JaneSmith.xml",
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
      id: "NjZjZmQzNTctODUzNi00NzhhLWE5MTEtOWRjNThjZTExNTFk",
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
      id: "NzdhOWNlNTYtNGY2YS00ZGQ4LWJiYzQtYmExYmYwYTY0OTIz",
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
      id: "ZDEyMjQ2ZWYtM2VkYi00ZGMzLWE4NTctNDc5NGRhNzViMWE3",
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
      id: "ZTZlMzU0MmMtNTM1Ni00OTEzLWEzMWQtNDc2MDZhZTI5NDFm",
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
      id: "MjQ2NWM2OTMtNjAzYS00MWE5LWExMzMtNWZlYmMzOGRhYmJi",
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
      id: "YmY0N2FiMjEtYWI4OC00MDZmLTllMmItY2I1MzhhMWU0NjU2",
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
