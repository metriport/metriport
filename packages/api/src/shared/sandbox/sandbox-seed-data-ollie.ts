import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const ollieDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "OllieBrown.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NDBjNTA5ODMtYWJmZi00ZmZiLTg1MTktNGU0NGE4YzJlOWY2",
      content: [
        {
          attachment: {
            title: "OllieBrown.xml",
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
      id: "NDM0MWUyNDktNDg4Ni00ZDhhLWFiNGUtY2Q2ZDY0ZDg0NTI2",
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
      id: "YTE1ZmE0MzYtNDA4My00MGE1LWFjMzgtZGU2ZTY1YmE0YTdh",
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
      id: "NWMxMmFlMjctYWE1My00ZGNkLTliYzMtZDA2Yjg3ZGQyMDg5",
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
      id: "MjNjMTdmYjItZDI4Yy00NDE5LWE0OWUtZmRjMWM3MzAxMWNm",
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
      id: "NWFlNTcwZGUtNGY3NS00OTI5LTk4NGItZTZhOWVmMTNlZTc1",
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
      id: "NzEzMzk1OWItZGVmYy00ZDViLTkzNzQtYTEyNzk0ZDMyMDAx",
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
