import { MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { jobInitialStatus } from "@metriport/shared/domain/job/job-status";
import { PatientJob } from "@metriport/shared/domain/job/patient-job";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Op, QueryTypes, Sequelize } from "sequelize";
import { Config } from "../../../../../../../util/config";
import { controlDuration } from "../../../../../../../util/race-control";
import { initDbPool } from "../../../../../../../util/sequelize";
import { buildRunJobHandler } from "../run/run-job-factory";
import { GetJobsHandler, GetJobsRequest } from "./get-jobs";

dayjs.extend(duration);

const CONTROL_TIMEOUT = dayjs.duration({ minutes: 15 });

export class GetJobsDirect implements GetJobsHandler {
  private readonly next = buildRunJobHandler();

  constructor(private readonly dbCreds: string) {}

  async getJobs(request: GetJobsRequest): Promise<void> {
    const jobs = await getJobsWithControlTimeout({
      context: "patient.getJobs.direct",
      dbCreds: this.dbCreds,
      ...request,
    });
    for (const job of jobs) {
      await this.next.runJob({
        id: job.id,
        cxId: job.cxId,
        jobType: job.jobType,
        paramsCx: job.paramsCx,
        paramsOps: job.paramsOps,
        data: job.data,
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
}): Promise<PatientJob[]> {
  const sequelize = initDbPool(dbCreds);
  const jobsTable = Config.getPatientJobsTableName();
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
}): Promise<PatientJob[]> {
  const whereClause = {
    ...{ scheduledAt: { [Op.lte]: jobCutoffDate } },
    ...{ scheduledAt: { [Op.not]: null } },
    ...{ status: status ?? jobInitialStatus },
    ...(id && { id }),
    ...(cxId && { cx_id: cxId }),
    ...(patientId && { patient_id: patientId }),
    ...(jobType && { job_type: jobType }),
  };
  const whereClauseString = Object.entries(whereClause)
    .map(([key, value]) => `${key} = '${value}'`)
    .join(" AND ");
  try {
    const query = `SELECT * FROM ${jobsTable} WHERE ${whereClauseString};`;
    const res = await sequelize.query<PatientJob>(query, {
      type: QueryTypes.SELECT,
    });

    return res;
  } catch (error) {
    const msg = `Failed to get jobs from table ${jobsTable}`;
    throw new MetriportError(msg, error, {
      jobsTable,
      whereClauseString,
      context: "patient.getJobs.direct.getJobsFromDb",
    });
  }
}
