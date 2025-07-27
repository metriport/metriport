import { out } from "@metriport/core/util";
import { sleep } from "@metriport/shared/common/sleep";
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
  apiUrl: string;
};

const delayTime = dayjs.duration(30, "seconds");

export class DocumentReconversionKickoffDirect {
  async execute({
    messageId,
    cxId,
    patientIds,
    dateFrom,
    dateTo,
    apiUrl,
  }: ReconversionKickoffParams) {
    const { log } = out(`reconvert-direct - cxId ${cxId}`);
    try {
      const endpointUrl = `${apiUrl}/internal/docs/re-convert`;
      const params = new URLSearchParams({
        cxId,
        patientIds: patientIds.join(","),
        dateFrom,
        ...(dateTo ? { dateTo } : {}),
      });

      log(`messageId ${messageId}, patientIds (${patientIds.length}): ${patientIds.join(",")}`);

      const resp = await axios.post(endpointUrl, undefined, { params });
      log(`API notified. Reconvert request ID - ${JSON.stringify(resp.data.requestId)}`);

      await sleep(delayTime.asMilliseconds());
    } catch (err) {
      const msg = "Patient docs reconvert kick off failed!";
      log(`${msg}. Error - ${err}`);
      throw err;
    }
  }
}
