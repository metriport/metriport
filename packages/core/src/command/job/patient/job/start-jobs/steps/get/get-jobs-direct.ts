import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { PatientJob, patientJobRawColumnNames } from "@metriport/shared/domain/job/patient-job";
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
      const job = {
        id: jobRaw[patientJobRawColumnNames.id],
        cxId: jobRaw[patientJobRawColumnNames.cxId],
        jobType: jobRaw[patientJobRawColumnNames.jobType],
      };
      await this.next.runJob({
        id: job.id,
        cxId: job.cxId,
        jobType: job.jobType,
      });
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  const sequelize = initDbPool(dbCreds);
  const jobsTable = PATIENT_JOB_TABLE_NAME;
  const jobCutoffDate = runDate ?? buildDayjs().toDate();

  try {
    // Run the table count until it either times out, or all the results are in the database
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any[]> {
  let whereClause = `
    scheduled_at <= '${jobCutoffDate.toISOString()}' AND
    status = '${status ?? jobInitialStatus}'
  `;
  if (id) whereClause += ` AND id = '${id}'`;
  if (cxId) whereClause += ` AND cx_id = '${cxId}'`;
  if (patientId) whereClause += ` AND patient_id = '${patientId}'`;
  if (jobType) whereClause += ` AND job_type = '${jobType}'`;
  try {
    const query = `SELECT * FROM ${jobsTable} WHERE ${whereClause};`;
    const res = await sequelize.query<PatientJob>(query, {
      type: QueryTypes.SELECT,
    });

    return res;
  } catch (error) {
    const msg = `Failed to get jobs from table ${jobsTable}`;
    throw new MetriportError(msg, error, {
      jobsTable,
      whereClause,
      context: "patient.getJobs.direct.getJobsFromDb",
    });
  }
}
