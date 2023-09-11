import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const wandaDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "wanda1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NGUxMDIzMGUtNzc1MS00OTViLWJjNzUtZGFmYjUxNmY3YTg5",
      content: [
        {
          attachment: {
            title: "wanda1.xml",
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
      key: "wanda11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OGZkODJhZGEtOTAyNy00ZjhjLTk5YjQtMzJlMjI0NDJiYzlk",
      content: [
        {
          attachment: {
            title: "wanda11.pdf",
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
      key: "wanda12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MzkwYTFiYjgtYWFhZi00ZjFmLWJhNjUtZjJmNzgwNTg3NDk4",
      content: [
        {
          attachment: {
            title: "wanda12.pdf",
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
      key: "wanda13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ODVmNDYwZmEtYzJmYi00NjM2LTkzNjItODIyOWNkYzk0Yzg5",
      content: [
        {
          attachment: {
            title: "wanda13.pdf",
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
      key: "wanda14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "Y2JhYjY1MmQtN2RkOS00MGU0LTgyZmUtNGMwNzE0NzczN2Ey",
      content: [
        {
          attachment: {
            title: "wanda14.tif",
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
      key: "wanda15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OTY3NWJlZjctODRkOC00YzkyLWFmZmMtY2U1MjNjOGZmNGJl",
      content: [
        {
          attachment: {
            title: "wanda15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
