import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { aggregateAndSetHIEProgresses, aggregateStatus } from "../set-doc-query-progress";
import { createProgress, addProgresses } from "./doc-progress-tests";

const requestId = "abc123";
const emptySourceProgress = { documentQueryProgress: {} };
const processingSourceProgress: Progress = createProgress({ status: "processing" });
const completedSourceProgress: Progress = createProgress({ status: "completed" });
const docQueryProgress: DocumentQueryProgress = {
  convert: processingSourceProgress,
  download: processingSourceProgress,
  requestId,
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

  it("has CW with total less than success and errors", async () => {
    const progress = createProgress({
      manuelProg: { total: 2, successful: 10, errors: 4, status: "processing" },
    });

    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: progress,
        },
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgress,
      convert: undefined,
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      overallDocQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      download: progress,
      requestId,
    });
  });

  it("has CW with total less than success and errors - CQ is correct", async () => {
    const progress = createProgress({
      manuelProg: { total: 2, successful: 10, errors: 4, status: "processing" },
    });

    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: progress,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          download: processingSourceProgress,
        },
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgress,
      convert: undefined,
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      overallDocQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      download: addProgresses(progress, processingSourceProgress, "processing"),
      requestId,
    });
  });

  it("has CW download and convert but no CQ", async () => {
    const progress = createProgress({
      manuelProg: { total: 2, successful: 10, errors: 4, status: "processing" },
    });

    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: progress,
          convert: progress,
        },
      },
      CAREQUALITY: emptySourceProgress,
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgress,
      convert: undefined,
    };

    const aggregateAndSetHIEProgressesResult = aggregateAndSetHIEProgresses(
      overallDocQueryProgress,
      externalData
    );

    expect(aggregateAndSetHIEProgressesResult).toEqual({
      download: progress,
      convert: progress,
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
      ...docQueryProgress,
      convert: undefined,
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

describe("aggregateStatus", () => {
  it("returns completed when gets no status", async () => {
    const resp = aggregateStatus([]);
    expect(resp).toEqual("completed");
  });
  it("returns completed when gets one completed", async () => {
    const resp = aggregateStatus(["completed"]);
    expect(resp).toEqual("completed");
  });
  it("returns completed when gets failed and completed", async () => {
    const resp = aggregateStatus(["failed", "completed"]);
    expect(resp).toEqual("completed");
  });
  it("returns failed when gets one failed", async () => {
    const resp = aggregateStatus(["failed"]);
    expect(resp).toEqual("failed");
  });
  it("returns processing when gets one processing", async () => {
    const resp = aggregateStatus(["processing"]);
    expect(resp).toEqual("processing");
  });
  it("returns processing when completed and processing", async () => {
    const resp = aggregateStatus(["completed", "processing"]);
    expect(resp).toEqual("processing");
  });
  it("returns processing when failed and processing", async () => {
    const resp = aggregateStatus(["failed", "processing"]);
    expect(resp).toEqual("processing");
  });
  it("returns processing when failed, completed and processing", async () => {
    const resp = aggregateStatus(["failed", "completed", "processing"]);
    expect(resp).toEqual("processing");
  });
});
