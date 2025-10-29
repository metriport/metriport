import { CwLinkV2 } from "@metriport/commonwell-sdk/models/patient";
import { isCWEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import { errorToString } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { BadRequestError, MetriportError } from "@metriport/shared";
import { PatientWithIdentifiers } from "../../../command/medical/patient/get-patient";
import { getCwPatientDataOrFail } from "../../commonwell/patient/cw-patient-data/get-cw-data";
import { CwLinkV1, isCwLinkV1, isCwLinkV2 } from "../../commonwell/patient/cw-patient-data/shared";
import { getLinkOrganizationId } from "../../commonwell/patient/cw-patient-data/update-cw-data";
import { getCwInitiator } from "../../commonwell/shared";
import { makeCommonWellAPI } from "../api";
import { getCommonwellPatientId } from "../patient/patient";

const context = "cw.link.unlink";

export async function unlink({
  patient,
  cxId,
  facilityId,
  linkSourceOid,
}: {
  patient: PatientWithIdentifiers;
  cxId: string;
  facilityId: string;
  linkSourceOid: string;
}): Promise<void> {
  const { log } = out(context);
  const { id: patientId } = patient;

  if (!(await isCWEnabledForCx(cxId))) {
    log(`CW is disabled for cxId: ${cxId}`);
    return;
  }

  const [initiator, cwPatientData] = await Promise.all([
    getCwInitiator({ id: patientId, cxId }, facilityId),
    getCwPatientDataOrFail({ id: patientId, cxId }),
  ]);

  const cwPatientId = getCommonwellPatientId(patient);
  if (!cwPatientId) {
    log(`No CW patient ID for patient`, patient.id);
    return;
  }

  const commonWell = makeCommonWellAPI(initiator.name, initiator.oid, initiator.npi);
  const targetLink = cwPatientData.data.links.find(
    link => isCwLinkV2(link) && getLinkOrganizationId(link) === linkSourceOid
  ) as CwLinkV2 | undefined;

  if (targetLink) {
    const unlinkUrl = targetLink.Links?.Unlink;
    if (!unlinkUrl) {
      throw new BadRequestError("Target link not found", undefined, {
        patientId,
        cxId,
        linkSourceOid,
      });
    }
    try {
      await commonWell.unlinkPatients(unlinkUrl);
      return;
    } catch (error) {
      const cwReference = commonWell.lastTransactionId;
      log(`Error unlinking target link: ${errorToString(error)}; cwReference ${cwReference}`);
      throw new MetriportError("Error unlinking target link", error, {
        cwReference,
        context,
      });
    }
  }

  const targetLinkInV1 = cwPatientData.data.links.find(
    link => isCwLinkV1(link) && getLinkOrganizationIdV1(link)?.includes(linkSourceOid)
  ) as CwLinkV1 | undefined;

  if (targetLinkInV1) {
    throw new BadRequestError(
      "Target link is stored in CW v1 format. Rerun PD to continue.",
      undefined,
      {
        patientId,
        cxId,
        linkSourceOid,
      }
    );
  }

  throw new BadRequestError("Target link not found", undefined, {
    patientId,
    cxId,
    linkSourceOid,
  });
}

function getLinkOrganizationIdV1(link: CwLinkV1): string | undefined {
  return link.patient?.provider?.reference ?? undefined;
}
