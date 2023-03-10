import { ExternalMedicalPartners } from "../../../external";

export type PatientLinkStatusDTO = "linked" | "needs-review";
export type PatientLinksDTO = { [k in ExternalMedicalPartners]: PatientLinkStatusDTO };
