import { makePatient, makePatientData } from "@metriport/core/domain/__tests__/patient";
import { DocumentQueryProgress, Progress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain//patient";
import {
  getPatientDocProgressFromHies,
  aggregateStatus,
  getHieDocProgress,
} from "../set-doc-query-progress";
import { createProgress, addProgresses, createProgressFromStatus } from "./doc-progress-tests";

const hieDocProgressBase = {
  requestId: "1234",
  startedAt: new Date(),
  triggerConsolidated: false,
};
const emptySourceProgress = { documentQueryProgress: {} };
const processingSourceProgress: Progress = createProgressFromStatus({ status: "processing" });
const completedSourceProgress: Progress = createProgressFromStatus({ status: "completed" });
const docQueryProgressProcessing: DocumentQueryProgress = {
  convert: processingSourceProgress,
  download: processingSourceProgress,
  ...hieDocProgressBase,
};

describe("getPatientDocProgressFromHies", () => {
  it("has download and convert processing when docQueryProgress is processing, CW is empty & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: emptySourceProgress,
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: processingSourceProgress,
      download: processingSourceProgress,
      ...hieDocProgressBase,
    });
  });

  it("has download and convert processing when docQueryProgress is processing, CW has download and convert processing & CQ is empty", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: emptySourceProgress,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: processingSourceProgress,
      download: processingSourceProgress,
      ...hieDocProgressBase,
    });
  });

  it("has download and convert processing when docQueryProgress is processing, CW has download processing & convert complete & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      ...hieDocProgressBase,
    });
  });

  it("has download and convert processing when docQueryProgress is processing, CW has download processing & convert complete & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: addProgresses(processingSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      ...hieDocProgressBase,
    });
  });

  it("has download and convert processing when docQueryProgress is processing, CW has download processing & convert complete & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      ...hieDocProgressBase,
    });
  });

  it("has download complete and convert processing when docQueryProgress is processing, CW has download processing & convert complete & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: processingSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: addProgresses(completedSourceProgress, processingSourceProgress, "processing"),
      download: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      ...hieDocProgressBase,
    });
  });

  it("has download complete and convert complete when docQueryProgress is processing, CW has download processing & convert complete & CQ has download and convert processing", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          convert: completedSourceProgress,
          download: completedSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      download: addProgresses(completedSourceProgress, completedSourceProgress, "completed"),
      ...hieDocProgressBase,
    });
  });

  it("has download processing when overallDocQueryProgress has download processing and CW has download processing", async () => {
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
          ...hieDocProgressBase,
        },
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgressProcessing,
      convert: undefined,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: overallDocQueryProgress,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      download: progress,
      ...hieDocProgressBase,
    });
  });

  it("has download processing when overallDocQueryProgress has download processing, CW has download processing & CQ has download processing", async () => {
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
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        documentQueryProgress: {
          download: processingSourceProgress,
          ...hieDocProgressBase,
        },
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgressProcessing,
      convert: undefined,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: overallDocQueryProgress,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      download: addProgresses(progress, processingSourceProgress, "processing"),
      ...hieDocProgressBase,
    });
  });

  it("has download & convert processing when overallDocQueryProgress has download processing, CW has download & convert processing & CQ has empty source", async () => {
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
          ...hieDocProgressBase,
        },
      },
      CAREQUALITY: {
        ...emptySourceProgress,
        ...hieDocProgressBase,
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgressProcessing,
      ...hieDocProgressBase,
      convert: undefined,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: overallDocQueryProgress,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      download: progress,
      convert: progress,
      ...hieDocProgressBase,
    });
  });

  it("has download & convert completed when docQueryProgress has download processing, CW & CQ are empty", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        ...emptySourceProgress,
        ...hieDocProgressBase,
      },
      CAREQUALITY: {
        ...emptySourceProgress,
        ...hieDocProgressBase,
      },
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: docQueryProgressProcessing,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      convert: { total: 0, errors: 0, status: "completed", successful: 0 },
      download: { total: 0, errors: 0, status: "completed", successful: 0 },
      ...hieDocProgressBase,
    });
  });

  it("has download completed when overallDocQueryProgress has download processing, CW & CQ are empty", async () => {
    const externalData: PatientExternalData = {
      COMMONWELL: {
        ...emptySourceProgress,
        ...hieDocProgressBase,
      },
      CAREQUALITY: {
        ...emptySourceProgress,
        ...hieDocProgressBase,
      },
    };

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgressProcessing,
      convert: undefined,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: overallDocQueryProgress,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual({
      download: { total: 0, errors: 0, status: "completed", successful: 0 },
      ...hieDocProgressBase,
    });
  });

  it("has download completed when overallDocQueryProgress has download processing, externalData is empty", async () => {
    const externalData: PatientExternalData = {};

    const overallDocQueryProgress: DocumentQueryProgress = {
      ...docQueryProgressProcessing,
      convert: undefined,
    };

    const patient = makePatient({
      data: makePatientData({
        documentQueryProgress: overallDocQueryProgress,
      }),
    });

    const patientDocProgress = getPatientDocProgressFromHies({
      patient,
      updatedExternalData: externalData,
    });

    expect(patientDocProgress).toEqual(
      expect.objectContaining({
        download: expect.objectContaining({ status: "completed" }),
      })
    );
  });
});

describe("getHieDocProgress", () => {
  it("has external data with downloadProgress when passing empty external data, download progress and source", async () => {
    const downloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: {},
      downloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: downloadProgress,
    });
  });

  it("has external data with newDownloadProgress when passing external data with download processing, newDownloadProgress processing and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        download: processingSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newDownloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: newDownloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: newDownloadProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with newDownloadProgress processing when passing external data with download complete, newDownloadProgress processing and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        download: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newDownloadProgress = createProgress({ status: "processing" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: newDownloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: newDownloadProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with newDownloadProgress completed when passing external data with download complete, newDownloadProgress completed and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        download: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newDownloadProgress = createProgress({ status: "completed" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: newDownloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: newDownloadProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with newDownloadProgress failed when passing external data with download complete, newDownloadProgress failed and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        download: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newDownloadProgress = createProgress({ status: "failed" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: newDownloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: newDownloadProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with completedSourceProgress when passing external data with download complete, newDownloadProgress undefined and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        download: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newDownloadProgress = undefined;

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: newDownloadProgress,
      convertProgress: undefined,
    });

    expect(hieDocProgress).toEqual({
      download: completedSourceProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with processingSourceProgress when passing external data with convert processing, newConvertProgress processing and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        convert: processingSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newConvertProgress = createProgress({ status: "processing" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: undefined,
      convertProgress: newConvertProgress,
    });

    expect(hieDocProgress).toEqual({
      convert: newConvertProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with processingSourceProgress when passing external data with convert complete, newConvertProgress processing and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        convert: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newConvertProgress = createProgress({ status: "processing" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: undefined,
      convertProgress: newConvertProgress,
    });

    expect(hieDocProgress).toEqual({
      convert: newConvertProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with completedSourceProgress when passing external data with convert complete, newConvertProgress completed and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        convert: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newConvertProgress = createProgress({ status: "completed" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: undefined,
      convertProgress: newConvertProgress,
    });

    expect(hieDocProgress).toEqual({
      convert: newConvertProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with failed when passing external data with convert complete, newConvertProgress failed and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        convert: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newConvertProgress = createProgress({ status: "failed" });

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: undefined,
      convertProgress: newConvertProgress,
    });

    expect(hieDocProgress).toEqual({
      convert: newConvertProgress,
      ...hieDocProgressBase,
    });
  });

  it("has external data with completedSourceProgress when passing external data with convert complete, newConvertProgress undefined and source", async () => {
    const existingHieDocProgress = {
      documentQueryProgress: {
        convert: completedSourceProgress,
        ...hieDocProgressBase,
      },
    };

    const newConvertProgress = undefined;

    const hieDocProgress = getHieDocProgress({
      externalHieData: existingHieDocProgress,
      downloadProgress: undefined,
      convertProgress: newConvertProgress,
    });

    expect(hieDocProgress).toEqual({
      convert: completedSourceProgress,
      ...hieDocProgressBase,
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
