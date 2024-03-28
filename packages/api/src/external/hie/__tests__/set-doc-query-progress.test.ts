import {
  DocumentQueryProgress,
  Progress,
  DocumentQueryStatus,
} from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { aggregateAndSetHIEProgresses } from "../set-doc-query-progress";

const requestId = "abc123";

const emptySourceProgress = { documentQueryProgress: {} };
const processingSourceProgress: Progress = {
  total: 10,
  errors: 4,
  status: "processing",
  successful: 2,
};
const completedSourceProgress: Progress = {
  total: 20,
  errors: 2,
  status: "completed",
  successful: 18,
};
const docQueryProgress: DocumentQueryProgress = {
  convert: processingSourceProgress,
  download: processingSourceProgress,
  requestId,
};

const addProgresses = (
  progress1: Progress,
  progress2: Progress,
  status: DocumentQueryStatus
): Progress => {
  return {
    total: (progress1.total ?? 0) + (progress2.total ?? 0),
    errors: (progress1.errors ?? 0) + (progress2.errors ?? 0),
    status: status,
    successful: (progress1.successful ?? 0) + (progress2.successful ?? 0),
  };
};

describe("aggregateAndSetHIEProgresses", () => {
  it("CQ has progress but CW does not", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: emptySourceProgress,
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: processingSourceProgress,
      download: processingSourceProgress,
      requestId,
    });
  });

  it("CW has progress but CQ does not", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
      CAREQUALITY: emptySourceProgress,
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: processingSourceProgress,
      download: processingSourceProgress,
      requestId,
    });
  });

  it("has CW with download/convert processing and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      requestId,
    });
  });

  it("has CW with download complete & convert processing and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: completedSourceProgress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download/convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download complete and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: completedSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      requestId,
    });
  });

  it("has CW with download/convert complete and CQ with download/convert complete", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
        },
      },
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      docQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      convert: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      download: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      requestId,
    });
  });

  it("has no external data progress", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: emptySourceProgress,
      CAREQUALITY: emptySourceProgress,
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

  it("has no external data progress - overall only download", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: emptySourceProgress,
      CAREQUALITY: emptySourceProgress,
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      convert: undefined,
      download: processingSourceProgress,
      requestId,
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      overallDocQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      download: { total: 0, errors: 0, status: "completed", successful: 0 },
      requestId,
    });
  });
});
