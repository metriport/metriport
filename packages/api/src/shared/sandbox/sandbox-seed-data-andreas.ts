import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const andreasDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "AndreasBrown.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YjE1ZDUxMGMtMTA4Ny00ODNlLTgxYmYtM2U2NGY5MjJmOWIx",
      content: [
        {
          attachment: {
            title: "AndreasBrown.xml",
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
      id: "M2QxYTFhYzMtOTcxMi00Y2U1LWFmYjYtZGZlZjFmYTJmZDVl",
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
      id: "MGQ4NmY2OTQtN2EwNC00ZjUwLWExNjctMTgxMjQyMWY1ZmYw",
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
      id: "OThlMDc1MmEtZDEwNS00YTc1LWEyYzEtNWI3MmM1ZTUwOGQ5",
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
      id: "YmFjZTgyMjgtOWFkNi00YWQ2LWIwMDctYThhMzE1ZDgwNzJi",
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
      id: "ZDRlYzYyMGUtZGJmMy00NzYyLWJhZDItZmY0ZWMwYzgzNDhi",
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
      id: "OTg0N2ZiNzAtNzk2MC00NTdmLWE3OWUtZDJiYTVmYjI3ZmE4",
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
