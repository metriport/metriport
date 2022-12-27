// https://stackoverflow.com/a/48244432/2099911
export type AtLeastOne<T, U = { [K in keyof T]: Pick<T, K> }> = Partial<T> &
  U[keyof U];
