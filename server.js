//#region Requirements
const express = require("express");
const app = express();

require("dotenv").config();

const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const multer = require("multer");
const upload = multer();
const bcrypt = require("bcrypt");

const DBConnect = require("./Utils/DBConnect.js");
const connection = DBConnect.connect();
//#endregion

//#region middleware
app.use(upload.none());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

app.use(
  cors({
    origin: process.env.ORIGIN.split(","),
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    key: "userID",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 60 * 60 * 24 * 3,
    },
  })
);
//#endregion

const PORT = process.env.PORT;
const SALT = 10;

app.get("/test", (req, res) => {
  res.json({ Result: "Working" });
});

app.get("/home", (req, res) => {
  connection.query("SELECT * FROM Products WHERE Status=1", (err, result) => {
    if (err) {
      console.error(`Error fetching data : \n${err}`);
      res.status(500).json({ error: "Failed to execute Query" });
    } else {
      res.status(200).json(result);
    }
  });
});

app.delete("/admin/product/delete", (req, res) => {
  const id = req.query.id;
  // TODO : implement removing from the database
  res.status(200).json({ state: "deleted" });
});

app.post("/admin/product/statechange", (req, res) => {
  const id = req.body.id;

  connection.query(
    `update Products set Status = not(Status) where ID=${id};`,
    (err, result) => {
      if (err) {
        console.error(`Error fetching data : \n${err}`);
        res.status(500).json({ error: "Failed to execute Query" });
      } else {
        res.status(200).json({ id: id });
      }
    }
  );
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    res.status(200).json({ loggedIn: true, user: req.session.user });
  } else {
    res.status(200).json({ loggedIn: false });
  }
});

app.post("/login/:userType", (req, res) => {
  const type = req.params.userType;
  const data = req.body;
  try {
    connection.query(
      `SELECT * FROM Users WHERE Email='${data.email}'`,
      (err, DBresult) => {
        if (err) {
          Error("Error getting emails : \n" + err);
        }
        if (DBresult.length === 1) {
          bcrypt.compare(data.password, DBresult[0].Password, (err, result) => {
            if (err) {
              Error("Error decrypting password : \n" + err);
            }
            if (result) {
              req.session.user = {
                Email: DBresult[0].Email,
                Name: DBresult[0].Name,
              };
              if (type === "admin" && data.email === "admin@admin.com") {
                res.status(200).json({ Access: true, redirect: "/admin" });
              } else {
                res.status(200).json({ Access: true });
              }
            } else {
              res.status(200).json({ Access: false });
            }
          });
        }
      }
    );
  } catch (error) {
    console.log(err);
    res.status(200).json({ error: "Internal Server Error" });
  }
  return;
});

app.post("/signup", async (req, res) => {
  const data = req.body;

  try {
    connection.query(
      `SELECT COUNT(*) AS Users FROM Users WHERE Email='${data.email}'`,
      (err, result) => {
        if (err) {
          Error("Error Validating User : \n" + err);
        }
        if (result[0].Users === 0) {
          bcrypt.hash(data.password, SALT, (err, result) => {
            if (err) {
              Error("Error encrpting data : \n" + err);
            }
            connection.query(
              `INSERT INTO Users (Email, Name, Password) VALUES ('${data.email.toLowerCase()}', '${
                data.name
              }', '${result}');`,
              (err, result) => {
                if (err) {
                  Error("Error adding user : \n" + err);
                }
                if (result.affectedRows === 1) {
                  res
                    .status(200)
                    .json({ message: "User added", signedUp: true });
                }
              }
            );
          });
        } else {
          res.status(200).json({ message: "User already exist" });
        }
      }
    );
  } catch (error) {
    console.error(error);
    res.status(200).json({ error: "Internal server error" });
  }
});

app.get("/brands", (req, res) => {
  try {
    connection.query("select * From Brands order by ID asc", (err, result) => {
      if (err) {
        Error("Error fetching data :\n" + err);
      }
      res.json(result);
    });
  } catch (error) {
    console.error(error);
    res.json({ error: "Internal server error" });
  }
});
app.get("/category", (req, res) => {
  try {
    connection.query(
      "select * From Categories order by ID asc",
      (err, result) => {
        if (err) {
          Error("Error fetching data :\n" + err);
        }
        res.json(result);
      }
    );
  } catch (error) {
    console.error(error);
    res.json({ error: "Internal server error" });
  }
});

app.post("/search", (req, res)=>{
  const data = req.body

  let query = `SELECT * FROM Products WHERE NAME LIKE '%${data.term}%'  AND Rating >= ${data.rating} AND Price <=${data.price} AND STATUS=1`
  if (data.brands !== ""){
    query += ` AND Brand IN (${data.brands})`;
  }
  if(data.categories !==""){
    query += ` AND Category IN (${data.categories})`;
  }
  
  connection.query(query, (err, result)=>{
    if(err){
      console.error(err)
    }
    else{
      res.json(result)
    }
  })
})
app.listen(PORT, () => {
  console.log(`Server lisening to port ${PORT}`);
});
