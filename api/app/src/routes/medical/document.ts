import { downloadDocument } from "../../command/medical/document/document-download";
import {
  createQueryResponse,
  DocumentQueryResp,
  queryDocumentsAcrossHIEs,
} from "../../command/medical/document/document-query";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import ForbiddenError from "../../errors/forbidden";
import { getDocuments } from "../../external/fhir/document/get-documents";
import { DocumentService } from "../../fern/generated/api/resources/document/service/DocumentService";
import { Config } from "../../shared/config";
import { checkMAPIAccess, processAPIKey } from "../middlewares/auth";
import { getCxIdOrFail, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";

export default new DocumentService(
  {
    get: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const patientId = getFromQueryOrFail("patientId", req);

      const documents = await getDocuments({ patientId });
      const documentsDTO = toDTO(documents);

      let query: DocumentQueryResp;

      const patient = await getPatientOrFail({ cxId, id: patientId });

      if (patient.data.documentQueryStatus === "processing") {
        query = createQueryResponse("processing", patient);
      } else {
        query = createQueryResponse("completed");
      }

      return res.send({
        queryStatus: query.queryStatus,
        queryProgress: query.queryProgress,
        documents: documentsDTO,
      });
    },

    triggerQuery: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const patientId = getFromQueryOrFail("patientId", req);
      const facilityId = getFromQueryOrFail("facilityId", req);

      const { queryStatus, queryProgress } = await queryDocumentsAcrossHIEs({
        cxId,
        patientId,
        facilityId,
      });

      return res.send({ queryStatus, queryProgress });
    },

    download: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const fileName = getFromQueryOrFail("fileName", req);
      const fileHasCxId = fileName.includes(cxId);

      if (!fileHasCxId && !Config.isSandbox()) throw new ForbiddenError();

      const url = await downloadDocument({ fileName });

      return res.send({ url });
    },
  },
  [processAPIKey, checkMAPIAccess]
);
