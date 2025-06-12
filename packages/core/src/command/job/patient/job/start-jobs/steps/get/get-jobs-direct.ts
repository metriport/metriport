import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { patientJobRawColumnNames } from "@metriport/shared/domain/job/patient-job";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";
import { controlDuration } from "../../../../../../../util/race-control";
import { initDbPool } from "../../../../../../../util/sequelize";
import { buildRunJobHandler } from "../run/run-job-factory";
import { GetJobsHandler, GetJobsRequest } from "./get-jobs";

dayjs.extend(duration);

const PATIENT_JOB_TABLE_NAME = "patient_job";

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
    for (const jobRaw of jobsRaw) {
      const id = jobRaw[patientJobRawColumnNames.id] as string;
      const cxId = jobRaw[patientJobRawColumnNames.cxId] as string;
      const jobType = jobRaw[patientJobRawColumnNames.jobType] as string;
      if (!id || !cxId || !jobType) {
        throw new MetriportError(`Invalid job: ${JSON.stringify(jobRaw)}`);
      }
      await this.next.runJob({ id, cxId, jobType });
    }
  }
}

async function getJobsWithControlTimeout({
  context,
  dbCreds,
  runDate,
  ...request
}: GetJobsRequest & {
  context: string;
  dbCreds: string;
}): Promise<Record<string, unknown>[]> {
  const sequelize = initDbPool(dbCreds);
  const jobsTable = PATIENT_JOB_TABLE_NAME;
  const jobCutoffDate = runDate ?? buildDayjs().toDate();

  try {
    const raceResult = await Promise.race([
      controlDuration(
        CONTROL_TIMEOUT.asMilliseconds(),
        `Timed out waiting for jobs, after ${CONTROL_TIMEOUT.asMilliseconds()} ms`
      ),
      getJobsFromDb({ sequelize, jobsTable, jobCutoffDate, ...request }),
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
  jobCutoffDate,
}: GetJobsRequest & {
  sequelize: Sequelize;
  jobsTable: string;
  jobCutoffDate: Date;
}): Promise<Record<string, unknown>[]> {
  const replacements: Record<string, unknown> = {
    jobCutoffDate: jobCutoffDate.toISOString(),
    status: status ?? jobInitialStatus,
  };
  const whereConditions = ["scheduled_at <= :jobCutoffDate", "status = :status"];
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
