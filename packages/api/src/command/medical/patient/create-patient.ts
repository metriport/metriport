import { Patient, PatientCreate, PatientData } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { out } from "@metriport/core/util/log";
import { processAsyncError } from "../../../errors";
import { makeIheGatewayAPIForPatientDiscovery } from "../../../external/ihe-gateway/api";
import { isCarequalityEnabled, isCommonwellEnabled } from "../../../external/aws/appConfig";
import cqCommands from "../../../external/carequality";
import cwCommands from "../../../external/commonwell";
import { PatientModel } from "../../../models/medical/patient";
import { Config } from "../../../shared/config";
import { getFacilityOrFail } from "../facility/get-facility";
import { getCqOrgIdsToDenyOnCw } from "../hie";
import { addCoordinatesToAddresses } from "./add-coordinates";
import { getPatientByDemo } from "./get-patient";
import { sanitize, validate } from "./shared";
import { processPatientDiscoveryProgress } from "../../../external/carequality/process-patient-discovery-progress";
import { shouldRunDiscovery } from "../../../external/carequality/patient";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

const iheGateway = makeIheGatewayAPIForPatientDiscovery();

export const createPatient = async (
  patient: PatientCreateCmd,
  forceCommonwell?: boolean,
  forceCarequality?: boolean
): Promise<Patient> => {
  const { cxId, facilityId, externalId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;

  const patientExists = await getPatientByDemo({
    cxId,
    demo: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  });
  if (patientExists) return patientExists;

  // validate facility exists and cx has access to it
  const facility = await getFacilityOrFail({ cxId, id: facilityId });

  const patientCreate: PatientCreate = {
    id: uuidv7(),
    cxId,
    facilityIds: [facilityId],
    externalId,
    data: { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact },
  };
  const addressWithCoordinates = await addCoordinatesToAddresses({
    addresses: patientCreate.data.address,
    patient: patientCreate,
    reportRelevance: true,
  });
  if (addressWithCoordinates) patientCreate.data.address = addressWithCoordinates;

  const newPatient = await PatientModel.create(patientCreate);

  // TODO move these to the respective "commands" files so this is fully async
  const [commonwellEnabled, carequalityEnabled] = await Promise.all([
    isCommonwellEnabled(),
    isCarequalityEnabled(),
  ]);

  if (commonwellEnabled || forceCommonwell || Config.isSandbox()) {
    // TODO: AWAIT HIE LOGIC AND MAKE INNER LOGIC ASYNC
    const baseLogMessage = `CQ PD - patientId ${newPatient.id}`;
    const { log: outerLog } = out(baseLogMessage);
    const shouldRun = await shouldRunDiscovery(cxId, iheGateway, outerLog);

    if (shouldRun) {
      await processPatientDiscoveryProgress({ patient: newPatient, status: "processing" });

      // Intentionally asynchronous
      cwCommands.patient
        .create(newPatient, facilityId, getCqOrgIdsToDenyOnCw)
        .catch(processAsyncError(`cw.patient.create`));
    }
  }

  if (carequalityEnabled || forceCarequality) {
    // Intentionally asynchronous
    cqCommands.patient
      .discover(newPatient, facility.data.npi)
      .catch(processAsyncError(`cq.patient.create`));
  }

  return newPatient;
};
