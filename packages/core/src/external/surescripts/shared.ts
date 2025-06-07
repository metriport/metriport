import { SurescriptsDirectory } from "./types";

export function getS3Key(directory: SurescriptsDirectory, fileName: string) {
  return `${directory}/${fileName}`;
}

export function getS3Directory(directory: SurescriptsDirectory) {
  return directory;
}

export function getSftpFileName(directory: SurescriptsDirectory, fileName: string) {
  return `/${directory}/${fileName}`;
}

export function getSftpDirectory(directory: SurescriptsDirectory) {
  return "/" + directory;
}
