const validEhrs = ["athenahealth", "elation", "canvas"];
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEhrIds(bodyAsJson: any) {
  const ehrIdRaw = bodyAsJson.ehrId;
  if (!ehrIdRaw) throw new Error(`Missing ehrId`);
  if (typeof ehrIdRaw !== "string") throw new Error(`Invalid ehrId`);
  if (!validEhrs.includes(ehrIdRaw)) throw new Error(`Invalid ehrId`);

  const ehrPracticeIdRaw = bodyAsJson.ehrPracticeId;
  if (!ehrPracticeIdRaw) throw new Error(`Missing ehrPracticeId`);
  if (typeof ehrPracticeIdRaw !== "string") throw new Error(`Invalid ehrPracticeId`);

  const ehrPatientIdRaw = bodyAsJson.ehrPatientId;
  if (!ehrPatientIdRaw) throw new Error(`Missing ehrPatientId`);
  if (typeof ehrPatientIdRaw !== "string") throw new Error(`Invalid ehrPatientId`);

  return { ehrIdRaw, ehrPracticeIdRaw, ehrPatientIdRaw };
}
