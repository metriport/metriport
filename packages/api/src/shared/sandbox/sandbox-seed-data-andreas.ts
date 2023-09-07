import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const andreasDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "andreas1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NmVjNjQ3M2EtODEwOS00NjI1LWExZjMtNmFmNWFlNDQxZDRh",
      content: [
        {
          attachment: {
            title: "andreas1.xml",
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
      key: "andreas11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "M2RjMWMyYTItY2QzNy00MWY5LWJlOTQtZGQzNjA0MTNhNWUy",
      content: [
        {
          attachment: {
            title: "andreas11.pdf",
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
      key: "andreas12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MGUzMWE4NDctN2FlNS00MDI2LWE4ZjUtZTZkMGM0MmM2ZTNi",
      content: [
        {
          attachment: {
            title: "andreas12.pdf",
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
      key: "andreas13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YTg1MmE3MGYtYWU1NS00MzRjLWIxNzctNTdkNGUwYWJhNGVh",
      content: [
        {
          attachment: {
            title: "andreas13.pdf",
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
      key: "andreas14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZTU5ODY0MGYtMTdhYi00ZWQ0LTkyOTktZmFiNDU5MmZkOTVi",
      content: [
        {
          attachment: {
            title: "andreas14.tif",
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
      key: "andreas15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NWY3MjYwZmUtNWIxYi00NzczLTgyZjAtYzJlMGFmOTUzMTJi",
      content: [
        {
          attachment: {
            title: "andreas15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
