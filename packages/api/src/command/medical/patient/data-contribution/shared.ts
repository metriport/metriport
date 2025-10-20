import { Bundle } from "@medplum/fhirtypes";
import { Patient } from "@metriport/core/domain/patient";
import { BadRequestError } from "@metriport/shared";
import { countResources } from "../../../../external/fhir/patient/count-resources";
import { Bundle as ValidBundle } from "../../../../routes/medical/schemas/fhir";
import { Config } from "../../../../shared/config";

const MAX_RESOURCE_COUNT_PER_REQUEST = 50;
const MAX_RESOURCE_STORED_LIMIT = 1000;

export function normalizeBundle<T extends Bundle | ValidBundle>(bundle: T): T {
  const bundleString = JSON.stringify(bundle);
  // String.fromCharCode(160) represents a non-breaking space (NBSP)
  const normalizedString = bundleString.replaceAll(String.fromCharCode(160), " ");
  return JSON.parse(normalizedString) as T;
}

/**
 * SANDBOX ONLY. Checks if the incoming amount of resources, plus what's already stored, exceeds the limit.
 */
export async function checkResourceLimit(incomingAmount: number, patient: Patient) {
  if (!Config.isCloudEnv() || Config.isSandbox()) {
    const { total: currentAmount } = await countResources({
      patient: { id: patient.id, cxId: patient.cxId },
    });
    if (currentAmount + incomingAmount > MAX_RESOURCE_STORED_LIMIT) {
      throw new BadRequestError(
        `Reached maximum number of resources per patient in Sandbox mode.`,
        null,
        { currentAmount, incomingAmount, MAX_RESOURCE_STORED_LIMIT }
      );
    }
    // Limit the amount of resources that can be created at once
    if (incomingAmount > MAX_RESOURCE_COUNT_PER_REQUEST) {
      throw new BadRequestError(`Cannot create this many resources at a time.`, null, {
        incomingAmount,
        MAX_RESOURCE_COUNT_PER_REQUEST,
      });
    }
  }
}

export function hasCompositionResource(bundle: ValidBundle): boolean {
  return bundle.entry.some(entry => entry.resource?.resourceType === "Composition");
}
