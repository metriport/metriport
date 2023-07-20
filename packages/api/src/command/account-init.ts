/**
 * Initialize customer/main account.
 * Should be idempotent, so it can be called multiple times without side effects.
 *
 * @param cxId the customer/account ID
 */
export async function accountInit(cxId: string): Promise<void> {
  console.log(`Initializing account ${cxId}, nothing to do here`);
}
