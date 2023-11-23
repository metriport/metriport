export type Org = {
  Id: string;
  Name: string;
};

export type Gateway = {
  Id: string;
  Name: string;
  Organizations: Org[];
};
