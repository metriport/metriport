import { PatientDemoData } from "@metriport/core/domain/patient";
import SalesforceApi from "@metriport/core/external/ehr/salesforce/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { BadRequestError, MetriportError, normalizeDob, normalizeGender } from "@metriport/shared";
import { salesforceDashSource } from "@metriport/shared/interface/external/ehr/salesforce/jwt-token";
import { Patient as SalesforcePatient } from "@metriport/shared/interface/external/ehr/salesforce/patient";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getJwtTokenByIdOrFail } from "../../../../command/jwt-token";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { getOrCreateMetriportPatient } from "../../shared/command/patient/get-or-create-metriport-patient";
import { createAddresses, createContacts, createNames, createSalesforceClient } from "../shared";

export type SyncSalesforcePatientIntoMetriportParams = {
  cxId: string;
  salesforcePracticeId: string;
  salesforcePatientId: string;
  salesforceInstanceUrl: string;
  salesforceTokenId: string;
  api?: SalesforceApi;
  triggerDq?: boolean;
};

export async function syncSalesforcePatientIntoMetriport({
  cxId,
  salesforcePracticeId,
  salesforcePatientId,
  salesforceInstanceUrl,
  salesforceTokenId,
  api,
  triggerDq = false,
}: SyncSalesforcePatientIntoMetriportParams): Promise<string> {
  const { log } = out(
    `syncSalesforcePatientIntoMetriport - practiceId: ${salesforcePracticeId} ptId: ${salesforcePatientId}`
  );

  const existingPatient = await getPatientMapping({
    cxId,
    externalId: salesforcePatientId,
    source: EhrSources.salesforce,
  });

  if (existingPatient) {
    log("existing patient mapping found", existingPatient.patientId);
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  log("no existing mapping found, creating new patient");

  const salesforceApi =
    api ??
    (await createSalesforceClientFromTokenId({
      cxId,
      practiceId: salesforcePracticeId,
      instanceUrl: salesforceInstanceUrl,
      tokenId: salesforceTokenId,
    }));
  const salesforcePatient = await salesforceApi.getPatientFromContact({
    cxId,
    patientId: salesforcePatientId,
  });
  const demographics = createMetriportPatientDemographics(salesforcePatient);

  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    source: EhrSources.salesforce,
    practiceId: salesforcePracticeId,
    demographics,
    externalId: salesforcePatientId,
  });

  const facilityId = await getPatientPrimaryFacilityIdOrFail({
    cxId,
    patientId: metriportPatient.id,
  });

  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
      facilityId,
    }).catch(processAsyncError(`Salesforce queryDocumentsAcrossHIEs`));
  }

  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: salesforcePatientId,
    source: EhrSources.salesforce,
    secondaryMappings: { practiceId: salesforcePracticeId },
  });

  return metriportPatient.id;
}

function createMetriportPatientDemographics(patient: SalesforcePatient): PatientDemoData {
  if (!patient.Birthdate) throw new BadRequestError("Patient has no dob");
  if (!patient.GenderIdentity) throw new BadRequestError("Patient has no gender");
  const dob = normalizeDob(patient.Birthdate);
  const genderAtBirth = normalizeGender(patient.GenderIdentity);
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const names = createNames(patient);
  return {
    ...names,
    dob,
    genderAtBirth,
    address: addressArray,
    contact: contactArray,
  };
}

async function createSalesforceClientFromTokenId({
  cxId,
  practiceId,
  instanceUrl,
  tokenId,
}: {
  cxId: string;
  practiceId: string;
  instanceUrl: string;
  tokenId: string;
}): Promise<SalesforceApi> {
  const token = await getJwtTokenByIdOrFail(tokenId);
  if (token.data.source !== salesforceDashSource) {
    throw new MetriportError("Invalid token source", undefined, {
      tokenId,
      source: token.data.source,
    });
  }
  const tokenPracticeId = token.data.practiceId;
  if (tokenPracticeId !== practiceId) {
    throw new MetriportError("Invalid token practiceId", undefined, {
      tokenId,
      source: token.data.source,
      tokenPracticeId,
      practiceId,
    });
  }
  return await createSalesforceClient({
    cxId,
    practiceId,
    authToken: token.token,
    instanceUrl,
  });
}
