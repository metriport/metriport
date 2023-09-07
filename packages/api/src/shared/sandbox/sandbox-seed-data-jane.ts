import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const janeDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "jane1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTIyMDEzODgtQzk1RC00RkU2LTlCNzAtQTQ4MTZBMDM3NzVB",
      content: [
        {
          attachment: {
            title: "jane1.xml",
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
      key: "jane11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItNzg5NC0xMjM0LTFCNzAtQjM4MTZBMDM3NzVC",
      content: [
        {
          attachment: {
            title: "jane11.pdf",
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
      key: "jane12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItNzg5NC1CNTQzLTFCNzAtQjM4MTZBMDM3NzVC",
      content: [
        {
          attachment: {
            title: "jane12.pdf",
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
      key: "jane13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItSDM5Mi1CNTQzLTFCNzAtQjM4MTZBMDM3NzVC",
      content: [
        {
          attachment: {
            title: "jane13.pdf",
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
      key: "jane14.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItSDM5Mi1CNTQzLTFCNzAtQjM4MTZBMDM3NzVD",
      content: [
        {
          attachment: {
            title: "jane14.jpeg",
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
      key: "jane15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItSDM5Mi1CNTQzLTFCNzAtQjM4MTZBMDM3NzZD",
      content: [
        {
          attachment: {
            title: "jane15.tif",
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
      key: "jane16.jpeg",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "QTExMDEzMjItSDM5Mi1CNTQzLTFCNzAtQjM4NDZBMDM3NzZD",
      content: [
        {
          attachment: {
            title: "jane16.jpeg",
            url: "http://api.metriport.com",
            contentType: "image/jpeg",
          },
        },
      ],
    },
  },
];
