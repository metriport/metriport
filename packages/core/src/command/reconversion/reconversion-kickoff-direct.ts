import { out } from "../../util/log";
import { errorToString } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export type ReconversionKickoffParams = {
  messageId: string;
  cxId: string;
  patientIds: string[];
  dateFrom: string;
  dateTo?: string;
};

export class DocumentReconversionKickoffDirect {
  constructor(private readonly apiUrl: string) {}

  async execute({ messageId, cxId, patientIds, dateFrom, dateTo }: ReconversionKickoffParams) {
    const { log } = out(`reconversion-kickoff-direct - cxId ${cxId}`);
    try {
      const endpointUrl = `${this.apiUrl}/internal/docs/re-convert`;
      const params = new URLSearchParams({
        cxId,
        patientIds: patientIds.join(","),
        dateFrom,
        ...(dateTo ? { dateTo } : {}),
      });

      log(`messageId ${messageId}, patientIds (${patientIds.length}): ${patientIds.join(",")}`);

      const resp = await axios.post(endpointUrl, undefined, { params });
      log(`API notified. Reconvert request ID - ${JSON.stringify(resp.data.requestId)}`);
    } catch (err) {
      const msg = "Patient docs reconvert kick off failed!";
      log(`${msg}. Error - ${errorToString(err)}`);
      throw err;
    }
  }
}
