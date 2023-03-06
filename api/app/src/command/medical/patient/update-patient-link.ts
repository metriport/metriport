import NotFoundError from "../../../errors/not-found";
import { Patient } from "../../../models/medical/patient";
import { LinkData } from "../../../models/medical/link";

export const updatePatientLinks = async ({
  id,
  cxId,
  linkData,
}: {
  id: string;
  cxId: string;
  linkData: LinkData;
}): Promise<void> => {
  const [count] = await Patient.update(
    {
      linkData,
    },
    { where: { id, cxId } }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patient link for id ${id} and cxId ${cxId}`);

  return;
};
