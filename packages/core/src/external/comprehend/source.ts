import { Bundle } from "@medplum/fhirtypes";
import { ExtractionSource } from "./types";
import { S3Utils } from "../aws/s3";
import { Config } from "../../util/config";

export class ComprehendExtractionSource implements ExtractionSource {
  private readonly medicalDocumentsBucketName: string;
  private readonly cdaToFhirBucketName: string | undefined;
  private readonly s3: S3Utils;

  constructor({
    medicalDocumentsBucketName = Config.getMedicalDocumentsBucketName(),
    cdaToFhirBucketName = Config.getCdaToFhirConversionBucketName(),
    region = Config.getAWSRegion(),
  }: {
    medicalDocumentsBucketName?: string;
    cdaToFhirBucketName?: string;
    region?: string;
  } = {}) {
    this.medicalDocumentsBucketName = medicalDocumentsBucketName;
    this.cdaToFhirBucketName = cdaToFhirBucketName;
    this.s3 = new S3Utils(region);
  }

  async getConsolidatedBundle(cxId: string, patientId: string): Promise<Bundle> {
    const bucketName = this.medicalDocumentsBucketName;
    const key = `${cxId}/${patientId}/${cxId}_${patientId}_CONSOLIDATED_DATA.json`;
    const bundle = await this.s3.downloadFile({ bucket: bucketName, key });
    return JSON.parse(bundle.toString()) as Bundle;
  }

  async listPatients(cxId: string): Promise<string[]> {
    const keyPrefix = `${cxId}/`;
    const directoryNames = await this.s3.listDirectoryNames(
      this.medicalDocumentsBucketName,
      keyPrefix
    );
    return directoryNames;
  }

  async listDocumentNames(cxId: string, patientId: string): Promise<string[]> {
    if (!this.cdaToFhirBucketName) {
      throw new Error("CdaToFhirConversionBucketName is not set");
    }
    const keyPrefix = `${cxId}/${patientId}/`;
    const documentObjects = await this.s3.listObjects(this.cdaToFhirBucketName, keyPrefix);
    const documentNames = documentObjects.flatMap(({ Key }) => {
      if (!Key) return [];
      const name = Key.substring(keyPrefix.length);
      if (!name.endsWith(".xml.from_converter.json")) return [];
      return [name];
    });
    return documentNames;
  }

  async getDocument(cxId: string, patientId: string, documentName: string): Promise<Bundle> {
    const bucketName = this.medicalDocumentsBucketName;
    const key = `${cxId}/${patientId}/${documentName}`;
    const bundle = await this.s3.downloadFile({ bucket: bucketName, key });
    return JSON.parse(bundle.toString()) as Bundle;
  }
}
