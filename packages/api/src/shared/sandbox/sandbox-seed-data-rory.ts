import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const roryDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "rory1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NjRlNWE3YzAtMjI1My00MDk3LTgyODYtM2VkMjUyN2RjZDRk",
      content: [
        {
          attachment: {
            title: "rory1.xml",
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
      key: "rory11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZWQ4ZmJiNWUtOWIwZS00MWE0LTljZWQtYzJmNzc5ZDQwMTAx",
      content: [
        {
          attachment: {
            title: "rory11.pdf",
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
      key: "rory12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YmVmZDQ1NDQtYmFkYS00NzZlLTg3YmUtZDk3YjU5MWIxNzAx",
      content: [
        {
          attachment: {
            title: "rory12.pdf",
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
      key: "rory13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OGYwMjZjNzctMzMxMS00ZTFiLWE0OTItNTFhMTVlZDA2Mzdj",
      content: [
        {
          attachment: {
            title: "rory13.pdf",
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
      key: "rory14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "YzY3MDkyNGYtODM4Ni00ZTQ5LTkzOGQtYTIyNjQ1NDBjZDU3",
      content: [
        {
          attachment: {
            title: "rory14.tif",
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
      key: "rory15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ODhhNGI5MjMtZTI0ZC00Mjc3LTgwZTUtMDQ0OTdjMWZmZmY1",
      content: [
        {
          attachment: {
            title: "rory15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
