import { webhookDisableFlagName } from "@metriport/core/domain/webhook/index";
import { Patient } from "@metriport/core/domain/patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { getPatientModelOrFail } from "./get-patient";

export type DisableWHMeta = {
  [webhookDisableFlagName]: boolean;
};
export type DisableWH = {
  meta: DisableWHMeta;
};

export type DisableWHCommand = {
  patient: Pick<Patient, "id" | "cxId">;
  field: "cxDocumentRequestMetadata" | "cxConsolidatedRequestMetadata";
  isDisableWH: boolean;
};

async function setDisableWHFlag(cmd: DisableWHCommand): Promise<Patient> {
  const {
    patient: { id, cxId },
    field,
    isDisableWH,
  } = cmd;

  const patient = await executeOnDBTx(PatientModel.prototype, async transaction => {
    const patient = await getPatientModelOrFail({
      id,
      cxId,
      lock: true,
      transaction,
    });

    const existingField = patient.dataValues.data[field];
    patient.dataValues.data = {
      ...patient.dataValues.data,
      [field]: {
        ...(existingField ? existingField : {}),
        [webhookDisableFlagName]: isDisableWH,
      },
    };

    return patient.save({ transaction });
  });
  return patient.dataValues;
}

export async function setDisableDocumentRequestWHFlag(
  cmd: Omit<DisableWHCommand, "field">
): Promise<Patient> {
  return setDisableWHFlag({
    ...cmd,
    field: "cxDocumentRequestMetadata",
  });
}

export async function setDisableConsolidatedRequestWHFlag(
  cmd: Omit<DisableWHCommand, "field">
): Promise<Patient> {
  return setDisableWHFlag({
    ...cmd,
    field: "cxConsolidatedRequestMetadata",
  });
}
