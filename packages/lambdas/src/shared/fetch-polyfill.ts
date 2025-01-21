/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch, { Headers, Request, Response } from "node-fetch";

if (!globalThis.fetch) {
  (globalThis as unknown as any).fetch = fetch;
  (globalThis as unknown as any).Headers = Headers;
  (globalThis as unknown as any).Request = Request;
  (globalThis as unknown as any).Response = Response;
}

export {};
