import { buildDayjs } from "@metriport/shared/common/date";

export function formatDatetime(dateString: string | undefined): string | undefined {
  if (!dateString || typeof dateString !== "string") return undefined;
  const preprocessedDate = dateString.replace(/[-:TZ]/g, "");
  if (!preprocessedDate || preprocessedDate.length < 8) return undefined;
  const year = preprocessedDate.slice(0, 4);
  const month = preprocessedDate.slice(4, 6);
  const day = preprocessedDate.slice(6, 8);
  const hour = preprocessedDate.slice(8, 10) || "00";
  const minute = preprocessedDate.slice(10, 12) || "00";
  const second = preprocessedDate.slice(12, 14) || "00";
  const formattedDate = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;

  try {
    const date = buildDayjs(formattedDate);
    return date.toISOString();
  } catch (error) {
    const msg = "Error creating date object for document reference";
    console.log(`${msg}: ${error}`);
  }

  return undefined;
}

export function formatDate(dateString: string | undefined): string | undefined {
  if (!dateString || typeof dateString !== "string") return undefined;
  const preprocessedDate = dateString.replace(/[^\d]/g, "");
  if (!preprocessedDate || preprocessedDate.length < 8) return undefined;
  const year = preprocessedDate.slice(0, 4);
  const month = preprocessedDate.slice(4, 6);
  const day = preprocessedDate.slice(6, 8);
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const date = buildDayjs(formattedDate);
    return date.toISOString();
  } catch (error) {
    const msg = "Error creating date object for document reference";
    console.log(`${msg}: ${error}`);
  }

  return undefined;
}
