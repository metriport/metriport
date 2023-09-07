import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const lexiDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "lexi1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MmRiMmQwYmItMTdiYy00ZTgwLWJmNDktYmE3OTUxMDljM2Qy",
      content: [
        {
          attachment: {
            title: "lexi1.xml",
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
      key: "lexi11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MmIxMWRkNWItZmY1NC00M2YzLWE4MjItNTk3YTJkZWVhNmEz",
      content: [
        {
          attachment: {
            title: "lexi11.pdf",
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
      key: "lexi12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZTEyYzMyZmYtZWQ1YS00MTFmLWI2ZDUtMDViNjZiMTQ4OWE1",
      content: [
        {
          attachment: {
            title: "lexi12.pdf",
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
      key: "lexi13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MDUwNzBjNDAtYWI1Ny00ZTBlLWI5OTktNWViOTA5ZDhhYzQy",
      content: [
        {
          attachment: {
            title: "lexi13.pdf",
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
      key: "lexi14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZGY5MjE3NmQtYzcyOC00YzkyLWFlYTItYWU0NDg4MzBlYWQx",
      content: [
        {
          attachment: {
            title: "lexi14.tif",
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
      key: "lexi15.png",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OWUxYWFjMWMtYjRhOS00YTFmLTgyZGItYjhhMTI1MWI2M2U0",
      content: [
        {
          attachment: {
            title: "lexi15.png",
            url: "http://api.metriport.com",
            contentType: "image/png",
          },
        },
      ],
    },
  },
];
