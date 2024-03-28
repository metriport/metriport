import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { aggregateAndSetHIEProgresses } from "../set-doc-query-progress";

const requestId = "abc123";
const docQueryProgress: DocumentQueryProgress = {
  convert: {
    total: 0,
    errors: 0,
    status: "processing",
    successful: 0,
  },
  download: {
    total: 0,
    errors: 0,
    status: "processing",
    successful: 0,
  },
  requestId,
};

describe("aggregateAndSetHIEProgresses", () => {
  it("CQ has progress but CW does not", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {},
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 20,
            errors: 2,
            status: "processing",
            successful: 4,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 10, errors: 4, status: "processing", successful: 2 },
      download: { total: 20, errors: 2, status: "processing", successful: 4 },
      requestId,
    });
  });

  it("CW has progress but CQ does not", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 20,
            errors: 2,
            status: "processing",
            successful: 4,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {},
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 10, errors: 4, status: "processing", successful: 2 },
      download: { total: 20, errors: 2, status: "processing", successful: 4 },
      requestId,
    });
  });

  it("has CW with download/convert processing and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 20,
            errors: 2,
            status: "processing",
            successful: 4,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 5,
            errors: 1,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 10,
            errors: 1,
            status: "processing",
            successful: 2,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 15, errors: 5, status: "processing", successful: 4 },
      download: { total: 30, errors: 3, status: "processing", successful: 6 },
      requestId,
    });
  });

  it("has CW with download complete & convert processing and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "processing",
            successful: 6,
          },
          download: {
            total: 20,
            errors: 2,
            status: "completed",
            successful: 4,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 5,
            errors: 1,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 10,
            errors: 1,
            status: "processing",
            successful: 2,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 15, errors: 5, status: "processing", successful: 8 },
      download: { total: 30, errors: 3, status: "processing", successful: 6 },
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "completed",
            successful: 6,
          },
          download: {
            total: 20,
            errors: 2,
            status: "completed",
            successful: 18,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 5,
            errors: 1,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 10,
            errors: 1,
            status: "processing",
            successful: 2,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 15, errors: 5, status: "processing", successful: 8 },
      download: { total: 30, errors: 3, status: "processing", successful: 20 },
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download complete and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "completed",
            successful: 6,
          },
          download: {
            total: 20,
            errors: 2,
            status: "completed",
            successful: 18,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 5,
            errors: 1,
            status: "processing",
            successful: 2,
          },
          download: {
            total: 10,
            errors: 1,
            status: "completed",
            successful: 9,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 15, errors: 5, status: "processing", successful: 8 },
      download: { total: 30, errors: 3, status: "completed", successful: 27 },
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download/convert complete", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: {
            total: 10,
            errors: 4,
            status: "completed",
            successful: 6,
          },
          download: {
            total: 20,
            errors: 2,
            status: "completed",
            successful: 18,
          },
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: {
            total: 5,
            errors: 1,
            status: "completed",
            successful: 4,
          },
          download: {
            total: 10,
            errors: 1,
            status: "completed",
            successful: 9,
          },
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 15, errors: 5, status: "completed", successful: 10 },
      download: { total: 30, errors: 3, status: "completed", successful: 27 },
      requestId,
    });
  });

  it("has no external data progress", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {},
      },
      CAREQUALITY: {
        documentQueryProgress: {},
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: { total: 0, errors: 0, status: "completed", successful: 0 },
      download: { total: 0, errors: 0, status: "completed", successful: 0 },
      requestId,
    });
  });
});
