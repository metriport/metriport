import { LinkSource } from "../../routes/medical/schemas/link";

export type LinkMapItem = {
  cw_person_id?: string;
};

export type LinkData = {
  [k in LinkSource]?: LinkMapItem;
};
