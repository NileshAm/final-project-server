const mysql = require("mysql");
require("dotenv").config();

var connection = null;
const env = process.env;

const connect = () => {
  if (connection === null) {
    connection = mysql.createConnection({
      host: env.HOST,
      user: env.USER,
      password: env.PASSWORD,
      database: env.DATABASE,
    });

    connection.connect((err) => {
      if (err) {
        console.error(`Error connecting to Database : \n ${err}`);
        connection = null;
        return null;
      }
      console.log("Database connected successfully");
    });
  }
  return connection;
};

module.exports = { connect };
