import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const kylaDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "KylaBrown.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "M2MxMmZhZjYtZDMxNC00YWI4LWFlYzEtYjU1ZjZhY2RhN2Uw",
      content: [
        {
          attachment: {
            title: "KylaBrown.xml",
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
      id: "MzYwMWRjNjYtYWZkZS00YjJkLWIwY2EtMDliNTdiMDM0OTVm",
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
      id: "ZWY0NTljNzMtOTU5MS00NzlkLWExZmEtMTVhOTYwNDU1MGQ2",
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
      id: "MmRiYjg0ZGQtZWEwZC00MjNhLWFjYTAtODk2YjY2ZDYyYmFk",
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
      id: "MTI3ZjgzZDEtYzE2Ny00ZWQ2LWE4N2EtOTQwZDBiNWUyN2Uw",
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
      id: "NGRhYTUxNDktZGQ4OC00ZDg0LTk3YWItNmM2YjIzMzhlMmFh",
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
      id: "Njc3OTQ1NjItMGJjYS00MzgyLWEwMjEtNzdjZTEyZWUzOTk5",
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
