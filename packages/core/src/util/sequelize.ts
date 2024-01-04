import { Sequelize } from "sequelize";

export function initSequelize(dbCreds: string) {
  const sqlDBCreds = JSON.parse(dbCreds);

  const sequelize = new Sequelize(sqlDBCreds.dbname, sqlDBCreds.username, sqlDBCreds.password, {
    host: sqlDBCreds.host,
    port: sqlDBCreds.port,
    dialect: sqlDBCreds.engine,
    pool: {
      max: 5,
      min: 1,
      acquire: 30000,
      idle: 10000,
    },
  });
  return sequelize;
}
