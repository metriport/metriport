export const createS3FileName = (cxId: string, fileName: string): string => {
  return `${cxId}-${fileName}`;
};
