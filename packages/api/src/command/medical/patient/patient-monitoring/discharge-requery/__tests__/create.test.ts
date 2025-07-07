import { faker } from "@faker-js/faker";
import * as domainFfsModule from "@metriport/core/command/feature-flags/domain-ffs";
import { JobStatus, PatientJob } from "@metriport/shared";
import { defaultRemainingAttempts } from "@metriport/shared/domain/patient/patient-monitoring/utils";
import dayjs from "dayjs";
import * as createJobModule from "../../../../../job/patient/create";
import * as getJobModule from "../../../../../job/patient/get";
import * as cancelJobModule from "../../../../../job/patient/status/cancel";
import { createDischargeRequeryJob } from "../create";

describe("createDischargeRequeryJob", () => {
  const mockDate = new Date("2024-01-01T12:00:00Z");

  let createPatientJobMock: jest.SpyInstance;
  let isFeatureFlagEnabledMock: jest.SpyInstance;
  let getPatientJobMock: jest.SpyInstance;
  let cancelPatientJobMock: jest.SpyInstance;
  let cxId: string;
  let patientId: string;
  let mockJob: PatientJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    cxId = faker.string.uuid();
    patientId = faker.string.uuid();

    mockJob = makePatientJob();

    createPatientJobMock = jest
      .spyOn(createJobModule, "createPatientJob")
      .mockResolvedValue(mockJob);

    isFeatureFlagEnabledMock = jest.spyOn(
      domainFfsModule,
      "isDischargeRequeryFeatureFlagEnabledForCx"
    );

    getPatientJobMock = jest.spyOn(getJobModule, "getPatientJobs");
    cancelPatientJobMock = jest.spyOn(cancelJobModule, "cancelPatientJob");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should create a new discharge requery job with default parameters", async () => {
    getPatientJobMock.mockResolvedValue([]);
    isFeatureFlagEnabledMock.mockResolvedValue(true);

    await createDischargeRequeryJob({
      cxId,
      patientId,
      goals: [],
    });

    expect(createPatientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        patientId,
        jobType: "discharge-requery",
        scheduledAt: dayjs(mockDate).add(5, "minutes").toDate(),
        paramsOps: {
          remainingAttempts: defaultRemainingAttempts,
        },
      })
    );
  });

  it("should create a new job with the closest scheduledAt", async () => {
    isFeatureFlagEnabledMock.mockResolvedValue(true);
    const existingJob = makePatientJob({
      scheduledAt: dayjs(mockDate).add(30, "minutes").toDate(),
      paramsOps: {
        remainingAttempts: defaultRemainingAttempts - 1,
      },
    });

    getPatientJobMock.mockResolvedValue([existingJob]);
    cancelPatientJobMock.mockResolvedValue(mockJob);
    await createDischargeRequeryJob({
      cxId,
      patientId,
      goals: [],
    });

    expect(cancelPatientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: existingJob.id })
    );
    expect(createPatientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        patientId,
        jobType: "discharge-requery",
        scheduledAt: dayjs(mockDate).add(5, "minutes").toDate(),
        paramsOps: {
          remainingAttempts: defaultRemainingAttempts,
        },
      })
    );
  });

  it("should create a new job with the correct remainingAttempts", async () => {
    isFeatureFlagEnabledMock.mockResolvedValue(true);
    const existingJob = makePatientJob({
      scheduledAt: dayjs(mockDate).add(2, "minutes").toDate(),
      paramsOps: {
        remainingAttempts: defaultRemainingAttempts - 2,
      },
    });

    getPatientJobMock.mockResolvedValue([existingJob]);
    cancelPatientJobMock.mockResolvedValue(mockJob);
    await createDischargeRequeryJob({
      cxId,
      patientId,
      goals: [],
    });

    expect(cancelPatientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: existingJob.id })
    );
    expect(createPatientJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        patientId,
        jobType: "discharge-requery",
        scheduledAt: dayjs(mockDate).add(2, "minutes").toDate(),
        paramsOps: {
          remainingAttempts: defaultRemainingAttempts,
        },
      })
    );
  });
});

function makePatientJob(
  params: Partial<PatientJob> = {
    jobType: "discharge-requery",
    status: "waiting" as JobStatus,
    statusReason: undefined,
  }
): PatientJob {
  return {
    id: params.id ?? faker.string.uuid(),
    cxId: params.cxId ?? faker.string.uuid(),
    patientId: params.patientId ?? faker.string.uuid(),
    jobType: params.jobType ?? "discharge-requery",
    jobGroupId: params.jobGroupId ?? faker.string.uuid(),
    requestId: params.requestId ?? faker.string.uuid(),
    status: params.status ?? ("waiting" as JobStatus),
    statusReason: params.statusReason,
    scheduledAt: params.scheduledAt ?? new Date(),
    startedAt: params.startedAt,
    finishedAt: params.finishedAt,
    cancelledAt: params.cancelledAt,
    failedAt: params.failedAt,
    total: params.total ?? 0,
    successful: params.successful ?? 0,
    failed: params.failed ?? 0,
    paramsCx: params.paramsCx,
    paramsOps: params.paramsOps,
    data: params.data,
    runtimeData: params.runtimeData,
    createdAt: params.createdAt ?? new Date(),
    runUrl: params.runUrl ?? faker.string.alpha({ length: { min: 130, max: 130 } }),
    ...params,
  };
}
