import { partition } from "lodash";
import { normalizePatientInboundMpi } from "../normalize-patient";
import { PatientData } from "../../domain/patient";
import { calculateFullNameScore } from "./match-name";
import { calculateDobScore } from "./match-dob";
import { calculateGenderScore } from "./match-gender";
import { calculateAddressScore } from "./match-address";
import { calculateContactScores } from "./match-contact";
import { calculateSsnScore, hasSsnData } from "./match.ssn";
import { checkBusinessRules } from "./match-business-rules";
import { crossValidateInvalidLinks } from "./cross-validate-links";

type LinkStatus = {
  patient: PatientData;
  isMatch: boolean;
  totalScore: number;
  scores: { [key: string]: number };
  failedRule: string | undefined;
};

export const SIMILARITY_THRESHOLD = 8.5;

export function filterPatientLinks(
  metriportPatient: PatientData,
  patientLinks: PatientData[],
  threshold = SIMILARITY_THRESHOLD
): LinkStatus[] {
  const linkStatuses = patientLinks.map(patientLink => {
    const algorithmResult = evaluatePatientMatch(metriportPatient, patientLink, threshold);
    return {
      patient: patientLink,
      isMatch: algorithmResult.isMatch,
      totalScore: algorithmResult.totalScore,
      scores: algorithmResult.scores,
      failedRule: algorithmResult.failedRule,
    };
  });

  const [validLinks, invalidLinks] = partition(linkStatuses, "isMatch");

  const crossValidatedLinks = crossValidateInvalidLinks(
    validLinks.map(link => link.patient),
    invalidLinks.map(link => link.patient)
  );

  const crossValidatedLinkStatuses = invalidLinks
    .filter(link => crossValidatedLinks.includes(link.patient))
    .map(link => ({
      ...link,
      isMatch: true,
      failedRule: undefined,
    }));

  const finalValidLinks = [...validLinks, ...crossValidatedLinkStatuses];
  const finalInvalidLinks = invalidLinks.filter(
    link => !crossValidatedLinks.includes(link.patient)
  );

  return [...finalValidLinks, ...finalInvalidLinks];
}

export function evaluatePatientMatch(
  metriportPatient: PatientData,
  externalPatient: PatientData,
  threshold = SIMILARITY_THRESHOLD
): {
  isMatch: boolean;
  totalScore: number;
  scores: { [key: string]: number };
  failedRule?: string;
} {
  const normalizedMetriportPatient = normalizePatientInboundMpi(metriportPatient);
  const normalizedExternalPatient = normalizePatientInboundMpi(externalPatient);

  const scores = {
    dob: 0,
    gender: 0,
    names: 0,
    address: 0,
    phone: 0,
    email: 0,
    ssn: 0,
  };

  scores.names = calculateFullNameScore(normalizedMetriportPatient, normalizedExternalPatient);
  scores.dob = calculateDobScore(normalizedMetriportPatient, normalizedExternalPatient);
  scores.gender = calculateGenderScore(normalizedMetriportPatient, normalizedExternalPatient);
  scores.address = calculateAddressScore(normalizedMetriportPatient, normalizedExternalPatient);
  scores.phone = calculateContactScores(
    normalizedMetriportPatient,
    normalizedExternalPatient
  ).phoneScore;
  scores.email = calculateContactScores(
    normalizedMetriportPatient,
    normalizedExternalPatient
  ).emailScore;
  scores.ssn = calculateSsnScore(normalizedMetriportPatient, normalizedExternalPatient);

  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);

  let isMatch = totalScore >= threshold;

  const failedRule = checkBusinessRules(
    normalizedMetriportPatient,
    normalizedExternalPatient,
    scores
  );
  if (failedRule) {
    return { isMatch: false, totalScore: 0, scores, failedRule };
  }

  if (hasSsnData(normalizedMetriportPatient, normalizedExternalPatient)) {
    const newThreshold = threshold + 1;
    isMatch = totalScore >= newThreshold;
  }

  return { isMatch, totalScore, scores };
}
