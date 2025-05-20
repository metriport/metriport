import {
  ingestLexical,
  initializeLexicalIndex,
} from "@metriport/core/command/consolidated/search/fhir-resource/ingest-lexical";
import {
  ingestLexicalFhir,
  initializeFhirIndex,
} from "@metriport/core/command/consolidated/search/fhir-resource/ingest-lexical-fhir";
import { out } from "@metriport/core/util/log";
import { BadRequestError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Request, Response } from "express";
import Router from "express-promise-router";
import status from "http-status";
import {
  ConsolidatedQueryParams,
  startConsolidatedQuery,
} from "../../../command/medical/patient/consolidated-get";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { getPatientIds } from "../../../command/medical/patient/get-patient-read-only";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { requestLogger } from "../../helpers/request-logger";
import { getUUIDFrom } from "../../schemas/uuid";
import {
  asyncHandler,
  getFromQuery,
  getFromQueryAsArray,
  getFromQueryAsArrayOrFail,
  getFromQueryAsBoolean,
} from "../../util";

dayjs.extend(duration);

const router = Router();

/**
 * POST /internal/patient/consolidated/query
 *
 * For each patient, get all consolidated queries that are older than 1 hour and are still processing, and:
 * - update the status of the query to "failed"; and
 * - start a new consolidated query with the same parameters.
 *
 * @param req.query.patientIds The patient IDs.
 * @param req.query.minAgeInMinutes The minimum age in minutes for the queries to be processed (optional,
 *        defaults to 60 minutes).
 * @param req.query.dryRun Whether to simply return what would be done or actually execute the changes
 *        and commands.
 * @return The list of consolidated queries that where be executed (or would be executed, if dryRun is true).
 */
router.post(
  "/query",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const patientIds = getFromQueryAsArrayOrFail("patientIds", req);
    const skipWebhooks = getFromQueryAsBoolean("skipWebhooks", req);
    if (skipWebhooks === undefined) throw new BadRequestError("skipWebhooks is required");
    const dryRun = getFromQueryAsBoolean("dryRun", req);
    if (dryRun === undefined) throw new BadRequestError("dryRun is required");
    const minAgeRaw = getFromQuery("minAgeInMinutes", req);
    const minAgeInMinutes = minAgeRaw ? parseInt(minAgeRaw) : 60;

    // TODO move this to an ops/internal command

    const patientsNotFound: string[] = [];
    const patientsUpdated: string[] = [];
    const patientsWithoutQueries: string[] = [];

    const triggeredQueries: ConsolidatedQueryParams[] = [];
    for (const patientId of patientIds) {
      const { log } = out(`patientId ${patientId} minAge ${minAgeInMinutes} dryRun ${dryRun}`);
      await executeOnDBTx(PatientModel.prototype, async transaction => {
        const patient = await PatientModel.findOne({
          where: { id: patientId },
          transaction,
        });
        if (!patient) {
          patientsNotFound.push(patientId);
          log(`not found`);
          return;
        }
        const consolidatedQueries = patient.data.consolidatedQueries ?? [];
        const queriesToProcess = consolidatedQueries.filter(
          query =>
            query.status === "processing" &&
            buildDayjs(query.startedAt).isBefore(
              buildDayjs().subtract(minAgeInMinutes, "minutes").toISOString()
            )
        );
        log(`queriesToProcess ${queriesToProcess.length}`);
        if (queriesToProcess.length > 0) {
          patientsUpdated.push(patientId);
          queriesToProcess.forEach(query => {
            query.status = "failed";
          });
          if (!dryRun) {
            const data = {
              ...patient.data,
              consolidatedQueries,
            };
            patient.changed("data", true);
            await patient.update({ data });
          }
        } else {
          patientsWithoutQueries.push(patientId);
        }
        for (const query of queriesToProcess) {
          const cxConsolidatedRequestMetadata = skipWebhooks ? { disableWHFlag: true } : undefined;
          const startConsolidatedQueryParams: ConsolidatedQueryParams = {
            cxId: patient.cxId,
            patientId,
            resources: query.resources,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
            conversionType: query.conversionType,
            generateAiBrief: query.generateAiBrief,
            cxConsolidatedRequestMetadata,
          };
          triggeredQueries.push(startConsolidatedQueryParams);
          if (!dryRun) {
            const query = await startConsolidatedQuery(startConsolidatedQueryParams);
            log(`triggered query ${JSON.stringify(query)}`);
          }
        }
      });
    }

    const { log } = out(`dryRun ${dryRun}`);

    const response = {
      dryRun,
      skipWebhooks,
      patientsNotFound,
      patientsUpdated,
      patientsWithoutQueries,
      triggeredQueries,
    };
    log(`response ${JSON.stringify(response)}`);

    return res.status(status.OK).json(response);
  })
);

/**
 * POST /internal/patient/consolidated/search/ingest
 *
 * Ingest patients' consolidated resources into OpenSearch for lexical search.
 *
 * To process a small amount of patients. If we need a larger amount of patients, we should
 * move this to a queue-based design, one pt per message.
 *
 * @param req.query.cxId The customer ID.
 * @param req.query.patientIds The patient IDs.
 */
router.post(
  "/search/ingest",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const cxId = getUUIDFrom("query", req, "cxId").orFail();
    const patientIds = getFromQueryAsArray("patientIds", req) ?? [];

    // TODO eng-268 temporary while we don't choose one approach
    await Promise.all([initializeLexicalIndex(), initializeFhirIndex()]);

    if (patientIds.length < 1) {
      out(`cx ${cxId}`).log(`no patientIds provided, getting all patients for this customer`);
      const allPatientIds = await getPatientIds({ cxId });
      patientIds.push(...allPatientIds);
    }

    for (const patientId of patientIds) {
      const patient = await getPatientOrFail({ cxId, id: patientId });
      // TODO eng-268 temporary while we don't choose one approach
      await Promise.all([ingestLexical({ patient }), ingestLexicalFhir({ patient })]);
    }

    return res.sendStatus(status.OK);
  })
);

export default router;
