export const asyncTest = (fn: () => Promise<void>) => async (): Promise<void> => {
  try {
    await fn();
  } catch (err) {
    console.log(err);
    throw err;
  }
};
