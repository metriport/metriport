import { errorToString, sleep } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { out } from "../../util/log";

dayjs.extend(duration);

export type ReconversionKickoffParams = {
  cxId: string;
  patientId: string;
  dateFrom: string;
  dateTo?: string;
};

export class DocumentReconversionKickoffDirect {
  constructor(private readonly apiUrl: string, private readonly waitTimeInMillis = 0) {}

  async execute({ cxId, patientId, dateFrom, dateTo }: ReconversionKickoffParams) {
    const { log } = out(`reconversion-kickoff-direct - cx: ${cxId}, pt: ${patientId}`);
    try {
      const endpointUrl = `${this.apiUrl}/internal/docs/re-convert`;
      const params = new URLSearchParams({
        cxId,
        patientIds: patientId,
        dateFrom,
        ...(dateTo ? { dateTo } : {}),
      });

      const resp = await axios.post(endpointUrl, undefined, { params });
      log(`API notified. Reconvert request ID - ${JSON.stringify(resp.data.requestId)}`);

      if (this.waitTimeInMillis > 0) {
        await sleep(this.waitTimeInMillis);
      }
    } catch (err) {
      const msg = "Patient docs reconvert kick off failed!";
      log(`${msg}. Error - ${errorToString(err)}`);
      throw err;
    }
  }
}
