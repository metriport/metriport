import { getLocalStorage } from "./local-storage";

export function getRequestIdSafe(): string | undefined {
  const asyncLocalStorage = getLocalStorage("reqId");
  const reqId = asyncLocalStorage.getStore();
  return reqId ?? undefined;
}

export function getRequestId(): string {
  const reqId = getRequestIdSafe();
  if (!reqId) throw new Error("Request ID not found in asyncLocalStorage");
  return reqId;
}
