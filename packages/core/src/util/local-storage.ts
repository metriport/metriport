import { AsyncLocalStorage } from "node:async_hooks";

type LocalStorage = "reqId";

const reqIdAsyncLocalStorage = new AsyncLocalStorage<string>();

/**
 * Returns a context to be used in async functions while processing a request.
 * See: https://nodejs.org/api/async_context.html
 *
 * To add more information on the request, like cx/user id, create a new storage
 * and return the correct one based on the param to `getLocalStorage()`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getLocalStorage(_: LocalStorage): AsyncLocalStorage<string> {
  return reqIdAsyncLocalStorage;
}
