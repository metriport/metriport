import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { patientJobRawColumnNames } from "@metriport/shared/domain/job/patient-job";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";
import { executeAsynchronously } from "../../../../../../../util";
import { controlDuration } from "../../../../../../../util/race-control";
import { initDbPool } from "../../../../../../../util/sequelize";
import { buildRunJobHandler } from "../run/run-job-factory";
import { GetJobsHandler, GetJobsRequest } from "./get-jobs";

dayjs.extend(duration);

const PATIENT_JOB_TABLE_NAME = "patient_job";
const MAX_PARALLEL_EXECUTIONS = 10;

const CONTROL_TIMEOUT = dayjs.duration({ minutes: 15 });

export class GetJobsDirect implements GetJobsHandler {
  private readonly next = buildRunJobHandler();

  constructor(private readonly dbCreds: string) {}

  async getJobs(request: GetJobsRequest): Promise<void> {
    const jobsRaw = await getJobsWithControlTimeout({
      context: "patient.getJobs.direct",
      dbCreds: this.dbCreds,
      ...request,
    });
    const jobs = jobsRaw.map(jobRaw => ({
      id: jobRaw[patientJobRawColumnNames.id] as string,
      cxId: jobRaw[patientJobRawColumnNames.cxId] as string,
      jobType: jobRaw[patientJobRawColumnNames.jobType] as string,
    }));
    await executeAsynchronously(jobs, job => this.next.runJob(job), {
      numberOfParallelExecutions: MAX_PARALLEL_EXECUTIONS,
    });
  }
}

async function getJobsWithControlTimeout({
  context,
  dbCreds,
  scheduledAtCutoff,
  ...request
}: GetJobsRequest & {
  context: string;
  dbCreds: string;
}): Promise<Record<string, unknown>[]> {
  const sequelize = initDbPool(dbCreds);
  const jobsTable = PATIENT_JOB_TABLE_NAME;
  const jobScheduledAtCutoff = scheduledAtCutoff ?? buildDayjs().toDate();

  try {
    const raceResult = await Promise.race([
      controlDuration(
        CONTROL_TIMEOUT.asMilliseconds(),
        `Timed out waiting for jobs, after ${CONTROL_TIMEOUT.asMilliseconds()} ms`
      ),
      getJobsFromDb({ sequelize, jobsTable, jobScheduledAtCutoff, ...request }),
    ]);
    if (typeof raceResult === "string") {
      throw new MetriportError(raceResult, undefined, {
        ...request,
        context,
      });
    }
    return raceResult;
  } catch (error) {
    const msg = `Failed to query jobs`;
    throw new MetriportError(msg, error, {
      ...request,
      context,
    });
  }
}

async function getJobsFromDb({
  id,
  cxId,
  patientId,
  jobType,
  status,
  sequelize,
  jobsTable,
  jobScheduledAtCutoff,
}: GetJobsRequest & {
  sequelize: Sequelize;
  jobsTable: string;
  jobScheduledAtCutoff: Date;
}): Promise<Record<string, unknown>[]> {
  const replacements: Record<string, unknown> = {
    jobScheduledAtCutoff: jobScheduledAtCutoff.toISOString(),
    status: status ?? jobInitialStatus,
  };
  const whereConditions = ["scheduled_at <= :jobScheduledAtCutoff", "status = :status"];
  if (id) {
    whereConditions.push("id = :id");
    replacements.id = id;
  }
  if (cxId) {
    whereConditions.push("cx_id = :cxId");
    replacements.cxId = cxId;
  }
  if (patientId) {
    whereConditions.push("patient_id = :patientId");
    replacements.patientId = patientId;
  }
  if (jobType) {
    whereConditions.push("job_type = :jobType");
    replacements.jobType = jobType;
  }
  try {
    const query = `SELECT * FROM ${jobsTable} WHERE ${whereConditions.join(" AND ")};`;
    const res = await sequelize.query<Record<string, unknown>>(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    return res;
  } catch (error) {
    const msg = `Failed to get jobs from table ${jobsTable}`;
    throw new MetriportError(msg, error, {
      jobsTable,
      context: "patient.getJobs.direct.getJobsFromDb",
    });
  } finally {
    await sequelize.close();
  }
}
