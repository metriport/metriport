import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { MedicalDataSource } from "@metriport/core/external/index";
import { PatientExternalData } from "@metriport/core/domain//patient";
import { aggregateAndSetHIEProgresses, setHIEDocProgress } from "../set-doc-query-progress";
import { createProgress, createProgressFromStatus, addProgresses } from "./doc-progress-tests";

const requestId = "abc123";
const emptySourceProgress = { documentQueryProgress: {} };
const processingSourceProgress: Progress = createProgressFromStatus({ status: "processing" });
const completedSourceProgress: Progress = createProgressFromStatus({ status: "completed" });
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
      total: 2,
      successful: 10,
      errors: 4,
      status: "processing",
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
      total: 2,
      successful: 10,
      errors: 4,
      status: "processing",
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
      total: 2,
      successful: 10,
      errors: 4,
      status: "processing",
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

  it("has no external doc progress - overall only download", async () => {
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

  it("has no external data progress - overall only download", async () => {
    const externalData: PatientExternalData = {};

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

describe("setHIEDocProgress", () => {
  it("has external data with downloadProgress when passing empty external data, download progress and source", async () => {
    const externalData = {};
    const downloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      downloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: downloadProgress,
        },
      },
    });
  });

  it("has external data with newDownloadProgress when passing external data with download processing, newDownloadProgress processing and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: processingSourceProgress,
        },
      },
    };

    const newDownloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      newDownloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: newDownloadProgress,
        },
      },
    });
  });

  it("has external data with newDownloadProgress processing when passing external data with download complete, newDownloadProgress processing and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: completedSourceProgress,
        },
      },
    };

    const newDownloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      newDownloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: newDownloadProgress,
        },
      },
    });
  });

  it("has external data with newDownloadProgress completed when passing external data with download complete, newDownloadProgress completed and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: completedSourceProgress,
        },
      },
    };

    const newDownloadProgress = createProgress({ status: "completed" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      newDownloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: newDownloadProgress,
        },
      },
    });
  });

  it("has external data with newDownloadProgress failed when passing external data with download complete, newDownloadProgress failed and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: completedSourceProgress,
        },
      },
    };

    const newDownloadProgress = createProgress({ status: "failed" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      newDownloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: newDownloadProgress,
        },
      },
    });
  });

  it("has external data with completedSourceProgress when passing external data with download complete, newDownloadProgress undefined and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          download: completedSourceProgress,
        },
      },
    };

    const newDownloadProgress = undefined;

    const hieDocProgress = setHIEDocProgress(
      externalData,
      newDownloadProgress,
      undefined,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          download: completedSourceProgress,
        },
      },
    });
  });

  it("has external data with processingSourceProgress when passing external data with convert processing, newConvertProgress processing and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
        },
      },
    };

    const newConvertProgress = createProgress({ status: "processing" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      undefined,
      newConvertProgress,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          convert: newConvertProgress,
        },
      },
    });
  });

  it("has external data with processingSourceProgress when passing external data with convert complete, newConvertProgress processing and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
        },
      },
    };

    const newConvertProgress = createProgress({ status: "processing" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      undefined,
      newConvertProgress,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          convert: newConvertProgress,
        },
      },
    });
  });

  it("has external data with completedSourceProgress when passing external data with convert complete, newConvertProgress completed and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
        },
      },
    };

    const newConvertProgress = createProgress({ status: "completed" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      undefined,
      newConvertProgress,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          convert: newConvertProgress,
        },
      },
    });
  });

  it("has external data with failed when passing external data with convert complete, newConvertProgress failed and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
        },
      },
    };

    const newConvertProgress = createProgress({ status: "failed" });

    const hieDocProgress = setHIEDocProgress(
      externalData,
      undefined,
      newConvertProgress,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          convert: newConvertProgress,
        },
      },
    });
  });

  it("has external data with completedSourceProgress when passing external data with convert complete, newConvertProgress undefined and source", async () => {
    const externalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
        },
      },
    };

    const newConvertProgress = undefined;

    const hieDocProgress = setHIEDocProgress(
      externalData,
      undefined,
      newConvertProgress,
      MedicalDataSource.COMMONWELL
    );

    expect(hieDocProgress).toEqual({
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
        },
      },
    });
  });
});
