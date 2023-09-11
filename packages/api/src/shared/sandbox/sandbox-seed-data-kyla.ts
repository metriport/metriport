import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const kylaDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "kyla1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NjNmYmZkZWMtNDkxZS00NDJmLThjNTUtNDJlN2E0NTJjYTll",
      content: [
        {
          attachment: {
            title: "kyla1.xml",
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
      key: "kyla11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NjE4MmZmNzUtNmI0MC00MTQyLTgwMTQtNTYyMmJlZTQyMjkx",
      content: [
        {
          attachment: {
            title: "kyla11.pdf",
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
      key: "kyla12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ODY4Y2UwYmYtODAxYi00YWU3LTgxYmUtMjAwYzhjYjVjOTM4",
      content: [
        {
          attachment: {
            title: "kyla12.pdf",
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
      key: "kyla13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "Yzk0NDNkN2YtODQyYy00Njc1LWE3OTEtMTMwYWIxYWY5NzZj",
      content: [
        {
          attachment: {
            title: "kyla13.pdf",
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
      key: "kyla14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NTBiY2FiMjEtOWIzMS00ZGE5LWE4NjUtOWRkYTY1MmQ4OTZh",
      content: [
        {
          attachment: {
            title: "kyla14.tif",
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
      key: "kyla15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YjY5YTE3ODktODYzNi00NmFlLWI3OGEtYjEwMTdhNzVkMzdh",
      content: [
        {
          attachment: {
            title: "kyla15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
