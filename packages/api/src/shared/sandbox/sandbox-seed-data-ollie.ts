import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const ollieDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "ollie1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "OWVlMGRhNDYtNDJkNS00ZWU0LWI1N2YtNjRjYWNlYjZmYTY2",
      content: [
        {
          attachment: {
            title: "ollie1.xml",
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
      key: "ollie11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "Y2RjMjhkNGUtZTg3Mi00NDQ3LThhYzAtZDkwNjkxMzdmNWUz",
      content: [
        {
          attachment: {
            title: "ollie11.pdf",
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
      key: "ollie12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZTBhMGUzOWMtNDVjMi00NDRkLWE5MDItMDFmNmU4ZDg3NmVj",
      content: [
        {
          attachment: {
            title: "ollie12.pdf",
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
      key: "ollie13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MDAyN2M2NGYtMzQ1Mi00MDNjLTg1MzYtNTg2YzYzM2JkMDY3",
      content: [
        {
          attachment: {
            title: "ollie13.pdf",
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
      key: "ollie14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "MGM2MTg5NzMtZDdiNy00NjUtYWMwYi02NDYyYjlhNTJkOWE",
      content: [
        {
          attachment: {
            title: "ollie14.tif",
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
      key: "ollie15.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZGIzYTk0YWYtZTFiYy00NGViLWJkYmQtNzdjNGQxNWEwZDJm",
      content: [
        {
          attachment: {
            title: "ollie15.tif",
            url: "http://api.metriport.com",
            contentType: "image/tiff",
          },
        },
      ],
    },
  },
];
