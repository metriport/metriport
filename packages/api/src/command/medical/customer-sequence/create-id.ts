import { CustomerSequenceModel, DataType } from "../../../models/medical/customer-sequence";
import { Config } from "../../../shared/config";
import { makeFacilityOID, makeOrganizationOID, makePatientOID } from "../../../shared/oid";
import { getOrganizationOrFail } from "../organization/get-organization";

export async function createOrganizationId(): Promise<{ id: string; organizationNumber: number }> {
  const organizationNumber = await nextSeq(Config.getSystemRootOID(), "organization");
  const id = makeOrganizationOID(organizationNumber);
  return { id, organizationNumber };
}

export async function createFacilityId(
  cxId: string
): Promise<{ id: string; facilityNumber: number }> {
  const facilityNumber = await nextSeq(cxId, "facility");
  const org = await getOrganizationOrFail({ cxId });
  const id = makeFacilityOID(org.id, facilityNumber);
  return { id, facilityNumber };
}

export async function createPatientId(
  cxId: string
): Promise<{ id: string; patientNumber: number }> {
  const patientNumber = await nextSeq(cxId, "patient");
  const org = await getOrganizationOrFail({ cxId });
  const id = makePatientOID(org.id, patientNumber);
  return { id, patientNumber };
}

export async function nextSeq(cxId: string, dataType: DataType): Promise<number> {
  const sequelize = CustomerSequenceModel.sequelize;
  if (!sequelize) throw new Error("Missing sequelize");

  const transaction = await sequelize.transaction();
  try {
    const res = await CustomerSequenceModel.findOne({
      where: { id: cxId, dataType },
      transaction,
      lock: true, // row lock
    });
    if (!res) throw new Error(`Missing customer sequence for cxId ${cxId} and ${dataType}`);

    const sequence = res.sequence + 1;
    await res.update({ sequence }, { transaction });

    await transaction.commit();
    return sequence;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
