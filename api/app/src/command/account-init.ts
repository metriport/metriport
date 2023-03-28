import _ from "lodash";
import { CustomerSequenceModel, DataType, dataTypes } from "../models/medical/customer-sequence";
import { FacilityModel } from "../models/medical/facility";
import { OrganizationModel } from "../models/medical/organization";
import { PatientModel } from "../models/medical/patient";
import { Config } from "../shared/config";
import { OID_ID_START } from "../shared/oid";

/**
 * Initialize customer/main account.
 * Should be idempotent, so it can be called multiple times without side effects.
 *
 * @param cxId the customer/account ID
 */
export async function accountInit(cxId: string): Promise<void> {
  await initSequences(cxId);
}

export async function initSequences(cxId: string): Promise<void> {
  // only initialize customer sequence for data types that are not "organization"
  const cxDataTypesForSeq = _.difference<DataType>(dataTypes, ["organization"]);
  const existingEntries = await CustomerSequenceModel.findAll({
    where: { id: [cxId] },
  });
  const diff = _.difference(
    cxDataTypesForSeq,
    existingEntries.map(e => e.dataType)
  );
  for (const dataType of diff) {
    const currSeq = await getMaxSeq(dataType, cxId);
    const seqNumber = currSeq ? currSeq + 1 : OID_ID_START;
    await CustomerSequenceModel.create({ id: cxId, dataType, sequence: seqNumber });
  }

  // make sure organization sequence is initialized
  const rootID = Config.getSystemRootOID();
  const orgEntry = await CustomerSequenceModel.findOne({
    where: { id: [rootID], dataType: "organization" },
  });
  if (!orgEntry) {
    const maxOrgNumber = await getMaxSeq("organization");
    await CustomerSequenceModel.create({
      id: rootID,
      dataType: "organization",
      sequence: maxOrgNumber ? Number(maxOrgNumber) + 1 : OID_ID_START,
    });
  }
}

async function getMaxSeq(dataType: DataType, cxId?: string): Promise<number | undefined> {
  const mapping: { [key in DataType]: () => Promise<number | undefined> } = {
    organization: () => OrganizationModel.max("organizationNumber"),
    facility: () => FacilityModel.max("facilityNumber", { where: { cxId } }),
    patient: () => PatientModel.max("patientNumber", { where: { cxId } }),
  };
  return mapping[dataType]();
}
