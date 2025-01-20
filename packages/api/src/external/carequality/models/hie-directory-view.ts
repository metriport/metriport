import { Sequelize } from "sequelize";
import { CQDirectoryEntryViewModel } from "./cq-directory-view";
import { BaseModel } from "../../../models/_default";

export class HIEDirectoryEntryViewModel extends CQDirectoryEntryViewModel {
  static override NAME = "hie_directory_view";
  static override setup = (sequelize: Sequelize) => {
    HIEDirectoryEntryViewModel.init(CQDirectoryEntryViewModel.getAttributes(), {
      ...BaseModel.modelOptions(sequelize),
      tableName: HIEDirectoryEntryViewModel.NAME,
    });
  };
}
