import NotFoundError from "../../../errors/not-found";
import { Patient } from "../../../models/medical/patient";

export const updatePatient = async ({
  id,
  cxId,
  data,
}: {
  id: string;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id, cxId }, returning: true }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} patients for id ${id} and cxId ${cxId}`);
  return rows[0];
};
