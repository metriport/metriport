import { FamilyMemberHistory } from "@medplum/fhirtypes";
import { MappedConsolidatedResources, SectionKey } from "..";
import { getFirstCodeSpecified, getResourcesFromBundle, getValidCode } from "..";

export type FamilyMemberHistoryRowData = {
  id: string;
  familyMember: string;
  sex: string;
  conditions: string;
  deceased: string;
};

export function familyMemberHistoryTableData({ bundle }: { bundle: MappedConsolidatedResources }) {
  const familyMemberHistories = getResourcesFromBundle<FamilyMemberHistory>(
    bundle,
    "FamilyMemberHistory"
  );

  return {
    key: "family-member-history" as SectionKey,
    rowData: getFamilyMemberHistoryRowData({ familyMemberHistories }),
  };
}

function getFamilyMemberHistoryRowData({
  familyMemberHistories,
}: {
  familyMemberHistories: FamilyMemberHistory[];
}): FamilyMemberHistoryRowData[] {
  return familyMemberHistories?.map(familyMemberHistory => ({
    id: familyMemberHistory.id ?? "-",
    familyMember: getFamilyMemberDisplay(familyMemberHistory),
    sex: renderAdministrativeGender(familyMemberHistory),
    conditions: renderFamilyHistoryFamilyMemberHistorys(familyMemberHistory),
    deceased: renderFamilyMemberDeceased(familyMemberHistory),
  }));
}

function getFamilyMemberDisplay(familyMemberHistory: FamilyMemberHistory): string {
  const codings = getValidCode(familyMemberHistory.relationship?.coding);
  const displays = codings.map(coding => coding.display);

  if (displays.length) {
    return displays.join(", ");
  } else if (familyMemberHistory.relationship?.text) {
    return familyMemberHistory.relationship.text;
  }

  return "-";
}

function renderAdministrativeGender(familyMemberHistory: FamilyMemberHistory): string {
  const adminGenCode = getFirstCodeSpecified(familyMemberHistory.sex?.coding, [
    "administrativegender",
  ]);

  if (adminGenCode?.code) {
    return adminGenCode.code;
  }

  return "-";
}

function renderFamilyHistoryFamilyMemberHistorys(familyMemberHistory: FamilyMemberHistory): string {
  const conditions = familyMemberHistory.condition?.map(condition => {
    return condition.code?.text ?? getValidCode(condition.code?.coding)[0]?.display;
  });

  return conditions?.join(", ") ?? "-";
}

function asYesNo(value: boolean): "yes" | "no" {
  return value ? ("yes" as const) : ("no" as const);
}

export function renderFamilyMemberDeceased(
  familyMemberHistory: FamilyMemberHistory
): "yes" | "no" | "" {
  const deceasedBoolean = familyMemberHistory.deceasedBoolean;
  if (deceasedBoolean !== undefined) {
    return asYesNo(deceasedBoolean);
  }

  const conditionContributedToDeath = familyMemberHistory.condition?.find(
    condition => condition.contributedToDeath
  );

  if (conditionContributedToDeath?.contributedToDeath !== undefined) {
    return asYesNo(conditionContributedToDeath.contributedToDeath);
  }

  return "";
}
