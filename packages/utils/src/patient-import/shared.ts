import _ from "lodash";
import { Patient } from "@metriport/shared/domain/patient";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { Config } from "@metriport/core/util/config";
import { SurescriptsDataMapper as DataMapper } from "@metriport/core/external/surescripts/data-mapper";
import {
  ParsedPatientError,
  ParsedPatientSuccess,
  PatientPayload,
} from "@metriport/core/command/patient-import/patient-import";

export function validToString(parsed: ParsedPatientSuccess) {
  return parsed.raw;
}

export function invalidToString(parsed: ParsedPatientError) {
  return escapeCsvValueIfNeeded(parsed.raw) + "," + parsed.error;
}

function escapeCsvValueIfNeeded(value: string) {
  if (value.includes(",")) {
    return `"${value}"`;
  }
  return value;
}

export function patientValidationToString(request: PatientPayload) {
  return JSON.stringify(request);
}

export function patientCreationToString(request: PatientPayload) {
  return JSON.stringify(request);
}

export async function buildExternalIdToPatientMap(cxId: string): Promise<Record<string, Patient>> {
  const dataMapper = new DataMapper();
  const customer = await dataMapper.getCustomerData(cxId);
  const externalIdToPatient: Record<string, Patient> = {};
  for (const facility of customer.facilities) {
    const externalIdToPatientForFacility = await buildExternalIdToPatientMapForFacility(
      cxId,
      facility.id
    );
    Object.assign(externalIdToPatient, externalIdToPatientForFacility);
  }
  return externalIdToPatient;
}

export async function buildExternalIdToPatientMapForFacility(
  cxId: string,
  facilityId: string
): Promise<Record<string, Patient>> {
  const dataMapper = new DataMapper();
  const patientIds = await dataMapper.getPatientIdsForFacility({ cxId, facilityId });

  // Retrieve each patient to construct a mapping of external IDs
  const patients = await dataMapper.getEachPatientById(cxId, patientIds);
  return Object.fromEntries(
    patients
      .filter(patient => patient.externalId != null)
      .map(patient => {
        return [patient.externalId, patient];
      })
  );
}

export async function listBulkImportJobIds(cxId: string): Promise<string[]> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const prefix = `patient-import/cxid=${cxId}/`;
  const files = await s3Utils.listFirstLevelSubdirectories({
    bucket: Config.getPatientImportBucket(),
    prefix,
  });
  return _.compact(
    files.map(file => {
      const jobIdMatch = file.Prefix?.match(/\/jobid=([\w\-_\d]+)\//);
      return jobIdMatch ? jobIdMatch[1] : undefined;
    })
  );
}

export async function getBulkImportRawInput(cxId: string, jobId: string): Promise<string> {
  const s3Utils = new S3Utils(Config.getAWSRegion());
  const fileKey = `patient-import/cxid=${cxId}/jobid=${jobId}/files/raw.csv`;
  return s3Utils.getFileContentsAsString(Config.getPatientImportBucket(), fileKey);
}
