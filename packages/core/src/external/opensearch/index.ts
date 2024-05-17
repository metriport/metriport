/**
 * Created outside of src/external/aws because this is an open source technology
 * that could be hosted outside of AWS.
 */

export const contentFieldName = "content";

export type IndexFields = {
  cxId: string;
  patientId: string;
  s3FileName: string;
  [contentFieldName]: string;
};
