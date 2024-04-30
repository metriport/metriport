import { Patient } from "@metriport/core/domain/patient";
import { Address } from "@metriport/core/domain/address";
import { getPatientOrFail } from "../../../command/medical/patient/get-patient";
import { PatientModel } from "../../../models/medical/patient";
import { executeOnDBTx } from "../../../models/transaction-wrapper";
import { InboundPatientResource } from "@metriport/ihe-gateway-sdk";

type PatientResourceAddres = InboundPatientResource["address"][number];

export async function testAndUpdatePatientDemographics({
  patient,
  patientResource,
}: {
  patient: Pick<Patient, "id" | "cxId">;
  patientResource: InboundPatientResource;
}): Promise<boolean> {
  const patientFilter = {
    id: patient.id,
    cxId: patient.cxId,
  };

  return await executeOnDBTx(PatientModel.prototype, async transaction => {
    const existingPatient = await getPatientOrFail({
      ...patientFilter,
      lock: true,
      transaction,
    });

    const newAddresses: PatientResourceAddres[] = patientResource.address.flatMap(
      (newAddress: PatientResourceAddres) => {
        const isNew: boolean = existingPatient.data.address.every(existingAddress =>
          checkNonMatchingAddress(newAddress, existingAddress)
        );
        if (isNew) return newAddress;
        return [];
      }
    );

    if (!newAddresses) {
      return false;
    }

    const newAddress = [...existingPatient.data.address, ...newAddresses];

    const updatedPatient = {
      ...existingPatient.dataValues,
      address: newAddress,
    };

    await PatientModel.update(updatedPatient, {
      where: patientFilter,
      transaction,
    });

    return true;
  });
}

export function checkNonMatchingAddress(
  address1: PatientResourceAddres,
  address2: Address
): boolean {
  return (
    (address1.line && address1.line.length > 0 && address1.line[0] !== address2.addressLine1) ||
    (address1.line && address1.line.length > 1 && address1.line[1] !== address2.addressLine2) ||
    address1.city !== address2.city ||
    address1.state !== address2.state ||
    address1.postalCode !== address2.zip
  );
}
