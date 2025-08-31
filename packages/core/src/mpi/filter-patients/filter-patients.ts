import { normalizePatientInboundMpi } from "../normalize-patient";
import { PatientData } from "../../domain/patient";
import { calculateNameScore } from "./match-name";
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

export function filterPatientLinks(
  metriportPatient: PatientData,
  patientLinks: PatientData[],
  threshold: number
): LinkStatus[] {
  let validLinks: LinkStatus[] = [];
  let invalidLinks: LinkStatus[] = [];

  for (const patientLink of patientLinks) {
    const { isMatch, totalScore, scores, failedRule } = linkFilteringAlgorithm(
      metriportPatient,
      patientLink,
      threshold
    );

    if (isMatch) {
      validLinks.push({
        patient: patientLink,
        isMatch,
        totalScore,
        scores,
        failedRule,
      });
    } else {
      invalidLinks.push({
        patient: patientLink,
        isMatch,
        totalScore,
        scores,
        failedRule,
      });
    }
  }

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

  validLinks = [...validLinks, ...crossValidatedLinkStatuses];
  invalidLinks = invalidLinks.filter(link => !crossValidatedLinks.includes(link.patient));

  return [...validLinks, ...invalidLinks];
}

export function linkFilteringAlgorithm(
  metriportPatient: PatientData,
  externalPatient: PatientData,
  threshold: number
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

  scores.names = calculateNameScore(normalizedMetriportPatient, normalizedExternalPatient);
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

  const businessRuleResult = checkBusinessRules(
    normalizedMetriportPatient,
    normalizedExternalPatient,
    scores
  );
  if (businessRuleResult) {
    return businessRuleResult;
  }

  if (hasSsnData(normalizedMetriportPatient, normalizedExternalPatient)) {
    const newThreshold = threshold + 1;
    isMatch = totalScore >= newThreshold;
  }

  return { isMatch, totalScore, scores };
}
