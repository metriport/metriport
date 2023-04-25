import { queryDocumentsAcrossHIEs } from "../../command/medical/document/document-query";
import { getDocuments } from "../../external/fhir/document/get-documents";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { getCxIdOrFail, getFromQuery, getFromQueryOrFail } from "../util";
import { toDTO } from "./dtos/documentDTO";
import { downloadDocument } from "../../command/medical/document/document-download";
import { DocumentService } from "../../fern/generated/api/resources/document/service/DocumentService";
import { processAPIKey, checkMAPIAccess } from "../middlewares/auth";
import { reportMedicalUsage } from "../middlewares/usage";

export default new DocumentService(
  {
    get: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const patientId = getFromQueryOrFail("patientId", req);
      const facilityId = getFromQueryOrFail("facilityId", req);
      const forceQuery = getFromQuery("force-query", req);

      const documents = await getDocuments({ patientId });
      const documentsDTO = toDTO(documents);

      const queryStatus = forceQuery
        ? await queryDocumentsAcrossHIEs({ cxId, patientId, facilityId })
        : (await getPatientOrFail({ cxId, id: patientId })).data.documentQueryStatus ?? "completed";

      return res.send({ queryStatus, documents: documentsDTO });
    },

    triggerQuery: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const patientId = getFromQueryOrFail("patientId", req);
      const facilityId = getFromQueryOrFail("facilityId", req);

      const queryStatus = await queryDocumentsAcrossHIEs({ cxId, patientId, facilityId });

      return res.send({ queryStatus });
    },

    download: async (req, res) => {
      const cxId = getCxIdOrFail(req);
      const fileName = getFromQueryOrFail("fileName", req);
      const fileHasCxId = fileName.includes(cxId);

      if (!fileHasCxId) throw new Error(`File does not belong to cxId: ${cxId}`);

      const url = await downloadDocument({ fileName });

      return res.send({ url });
    },
  },
  [processAPIKey, checkMAPIAccess, reportMedicalUsage]
);
