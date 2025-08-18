import { GenderAtBirth } from "@metriport/shared/domain/gender";

export interface RunGenderizeHandler {
    execute(request: RunGenderizeRequest): Promise<GenderAtBirth>;
}

export type RunGenderizeRequest = {
    name: string;
}