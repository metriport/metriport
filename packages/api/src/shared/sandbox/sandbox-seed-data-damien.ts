import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const damienDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "damien1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMTQtQkIxNC1DQzE0LUREMTQtRUVFRUVFRUVFRTE0",
      content: [
        {
          attachment: {
            title: "damien1.xml",
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
      key: "damien11.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMjQtQkIyNC1DQzI0LUREMjQtRUVFRUVFRUVFRTI0",
      content: [
        {
          attachment: {
            title: "damien11.tif",
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
      key: "damien12.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMjUtQkIyNS1DQzI1LUREMjUtRUVFRUVFRUVFRTI1",
      content: [
        {
          attachment: {
            title: "damien12.tif",
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
      key: "damien13.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMjctQkIyNy1DQzI3LUREMjctRUVFRUVFRUVFRTI3",
      content: [
        {
          attachment: {
            title: "damien13.tif",
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
      key: "damien14.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMjgtQkIyOC1DQzI4LUREMjgtRUVFRUVFRUVFRTI4",
      content: [
        {
          attachment: {
            title: "damien14.jpeg",
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
      key: "damien15.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QUFBQUFBMjktQkIyOS1DQzI5LUREMjktRUVFRUVFRUVFRTI5",
      content: [
        {
          attachment: {
            title: "damien15.jpeg",
            url: "http://api.metriport.com",
            contentType: "image/jpeg",
          },
        },
      ],
    },
  },
];
