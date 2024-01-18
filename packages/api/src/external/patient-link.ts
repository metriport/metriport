import { MedicalDataSource } from "@metriport/core/external/index";

export type LinkStatus = "completed" | "processing" | "failed";

export type LinkStatusAcrossHIEs = { [k in MedicalDataSource]: LinkStatus };
