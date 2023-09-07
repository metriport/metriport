import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const heatherDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "heather1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExMzAtQjEzMC1DMTMwLUQxMzAtRUVFRUVFRUVFMTMw",
      content: [
        {
          attachment: {
            title: "heather1.xml",
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
      key: "heather11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExNDAtQjE0MC1DMTQwLUQxNDAtRUVFRUVFRUVFMTQw",
      content: [
        {
          attachment: {
            title: "heather11.pdf",
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
      key: "heather12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExNDEtQjE0MS1DMTQxLUQxNDEtRUVFRUVFRUVFMTQx",
      content: [
        {
          attachment: {
            title: "heather12.pdf",
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
      key: "heather13.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExNDItQjE0Mi1DMTQyLUQxNDItRUVFRUVFRUVFMTQy",
      content: [
        {
          attachment: {
            title: "heather13.tif",
            url: "http://api.metriport.com",
            contentType: "application/tif",
          },
        },
      ],
    },
  },
  {
    s3Info: {
      bucket,
      key: "heather14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExNDMtQjE0My1DMTQzLUQxNDMtRUVFRUVFRUVFMTQz",
      content: [
        {
          attachment: {
            title: "heather14.tif",
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
      key: "heather15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUExNDQtQjE0NC1DMTQ0LUQxNDQtRUVFRUVFRUVFMTQ0",
      content: [
        {
          attachment: {
            title: "heather15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
