export enum LinkSource {
  commonWell = "CommonWell",
  careQuality = "CareQuality",
  eHealthExchange = "eHealthExchange",
}

export type LinkMapItem = {
  cw_person_id?: string;
};

export type LinkData = {
  [k in LinkSource]?: LinkMapItem;
};
