import Router from "express-promise-router";
import httpStatus from "http-status";
import { Request, Response } from "express";
import CanvasSDK from "@metriport/core/external/canvas/index";
import { requestLogger } from "../../helpers/request-logger";
import { asyncHandler, getAuthorizationToken, getFrom } from "../../util";

const router = Router();

router.post(
  "/:id/medication",
  requestLogger,
  asyncHandler(async (req: Request, res: Response) => {
    const accessToken = getAuthorizationToken(req);
    const patientKey = getFrom("params").orFail("id", req);
    const canvas = await CanvasSDK.create({
      environment: "develop",
      clientId: "ignore",
      clientSecret: "ignore",
      authToken: accessToken,
    });
    const noteId = await canvas.createNote({
      patientKey,
      providerKey: "FILL", // ID form `select key from api_staff WHERE first_name = 'Larry';`
      practiceLocationKey: "FILL", // ID from `select externally_exposable_id from api_practicelocation;`
      noteTypeName: "Chart Review",
      returnKey: "id",
    });
    const medicationStatement = await canvas.createNoteMedicationStatement({
      patientId: "FILL", // ID from `select id from api_patient;`
      noteId,
    });
    const medicationStatementId = (medicationStatement as { id: string }).id;
    await canvas.updateNoteMedicationStatement({
      medicationStatementId,
      medicationStatement: {
        medication: {
          value: "155071:methocarbamol 500 mg tablet",
          descriptionAndQuantity: "methocarbamol 500 mg tablet",
          medMedicationId: 155071,
          clinicalQuantities: [
            {
              representativeNdc: "10135066401",
              erxQuantity: "1.0000000",
              clinicalQuantityDescription: "tablet",
              erxNcpdpScriptQuantityQualifierCode: "C48542",
              erxNcpdpScriptQuantityQualifierDescription: "Tablet",
            },
          ],
          coding: [
            {
              code: "155071",
              display: "methocarbamol 500 mg tablet",
              system: "http://www.fdbhealth.com/",
            },
            {
              code: "197943",
              display: "methocarbamol 500 mg tablet",
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
            },
          ],
        },
      },
    });
    const note = await canvas.getNote({ noteId });

    await canvas.updateNote({
      noteId,
      note: {
        ...note,
        body: [
          { type: "text", value: "Metriport Imported Data" },
          { type: "text", value: "" },
          { data: { id: +medicationStatementId }, type: "command", value: "medicationStatement" },
        ],
        serializedBody: [
          { lineType: "text", value: "Metriport Imported Data" },
          { lineType: "text", value: "" },
          {
            urn: "TWVkaWNhdGlvblN0YXRlbWVudDoxOTI6OA==",
            permalink: "/permalinks/v1/TWVkaWNhdGlvblN0YXRlbWVudDoxOTI6OA==",
            lineType: "command",
            clientKey: `medicationStatement|${medicationStatementId}`,
            coreTypeKey: "medicationStatement",
            name: "Medication Statement",
            simple: false,
            commitText: "commit",
            commitActions: null,
            commitAction: null,
            noteSection: "history",
            collapseOnCommit: false,
            committed: false,
            enteredInError: false,
            audit: {
              originator: "Larry Weed",
              editors: ["Larry Weed"],
              committer: null,
              enteredInError: null,
            },
            dataDriven: false,
            printUrls: null,
            faxAction: null,
            fields: [],
            customStatus: null,
            id: +medicationStatementId,
            commandUuid: null,
          },
        ],
      },
    });
    return res.sendStatus(httpStatus.NO_CONTENT);
  })
);

export default router;
