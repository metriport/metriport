import { getDocuments } from "@metriport/core/external/fhir/document/get-documents";
import { out } from "@metriport/core/util/log";
import { getPatientOrFail } from "../medical/patient/get-patient";
import { getCQPatientData } from "../../external/carequality/command/cq-patient-data/get-cq-data";
import { getCwPatientData } from "../../external/commonwell/command/cw-patient-data/get-cw-data";

type UnlinkPatientFromOrganizationParams = {
  cxId: string;
  patientId: string;
  oid: string;
};

export async function unlinkPatientFromOrganization({
  cxId,
  patientId,
  oid,
}: UnlinkPatientFromOrganizationParams): Promise<void> {
  const { log } = out(`unlinkPatientFromOrganization - M patient ${patientId}`);

  const cqPatientData = await getCQPatientData({ id: patientId, cxId });
  const cwPatientData = await getCwPatientData({ id: patientId, cxId });

  const documents = await getDocuments({ cxId, patientId });

  // const documentsWithOid;
}
