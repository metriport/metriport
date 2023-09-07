import { bucket, DataEntry } from "./sandbox-seed-data-defaults";

export const hajraDocRefs: DataEntry[] = [
  {
    s3Info: {
      bucket,
      key: "hajra1.xml",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZjhiMjhkYmUtYzM5Ni00YmYyLWIwMzItNDZlYWMyNzhhNzdm",
      content: [
        {
          attachment: {
            title: "hajra1.xml",
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
      key: "hajra11.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "N2JkOTFmMjktYmE5Ny00NjhmLTg0ZTEtOWU1NDVhMTkzNzcy",
      content: [
        {
          attachment: {
            title: "hajra11.pdf",
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
      key: "hajra12.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZTAyZTIxODAtYjBjNi00ZGNmLTk4ZTAtMjg1ZDFhZmIwOTYw",
      content: [
        {
          attachment: {
            title: "hajra12.pdf",
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
      key: "hajra13.pdf",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "Zjk0YWJkYTYtNjkxMC00MTQ0LTg4NzktN2FjMTQ0YzYyNmJk",
      content: [
        {
          attachment: {
            title: "hajra13.pdf",
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
      key: "hajra14.tif",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "NTc0MzY1YzItZGM4ZS00N2NhLTg4NjgtMmY0NTQyZWMzNjhm",
      content: [
        {
          attachment: {
            title: "hajra14.tif",
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
      key: "hajra15.png",
    },
    docRef: {
      resourceType: "DocumentReference",
      id: "ZmNkYTc0ZDgtMzk4NC00OWU5LWFiNjktODI5NDExZGE5ODI0",
      content: [
        {
          attachment: {
            title: "hajra15.png",
            url: "http://api.metriport.com",
            contentType: "image/png",
          },
        },
      ],
    },
  },
];
