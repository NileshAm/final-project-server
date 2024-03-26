//#region Requirements
const express = require("express");
const app = express();

require("dotenv").config();

const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcrypt");
const uuid = require("uuid");

const firebase = require("./Utils/Firebase.js");
const fileHandler = require("./Utils/fileHandler.js");
const DBConnect = require("./Utils/DBConnect.js");

const connection = DBConnect.connect();
firebase.initialize();
// const firebaseStorage = firebase.getStorageBucket
//#endregion

//#region middleware
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

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    return callback(null, "./temp/images");
  },
  filename: (req, file, callback) => {
    return callback(null, uuid.v4() + "." + file.originalname.split(".")[1]);
  },
});

const upload = multer({ storage });
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

app.post("/admin/product/add", upload.single("image"), async (req, res) => {
  const data = req.body;

  // #region Data validation
  for (val of Object.values(req.body)) {
    if (val === "") {
      res.json({ error: "Invalid Data Sent", code: 400 });
      return;
    }
  }
  if (!req.file) {
    res.json({ error: "Invalid Data Sent", code: 400 });
    return;
  }
  //#endregion


  await connection.query(
    `SELECT COUNT(*) AS Count  From Products WHERE Name = '${data.name}'`,
    async (err, result) => {
      console.log(result);
      if (err) {
        console.error(err);
        fileHandler.deleteFile(req.file);
        res.json({ error: "Error fetching data", code: 400 });
        return;
      }
      if (result[0].Count === 1) {
        res.json({ error: "Product already exist", code: 400 });
        fileHandler.deleteFile(req.file);
        return;
      }
      if (result[0].Count === 0) {
        webpfile = await fileHandler.convert2webp(req.file);
        console.log(webpfile);
        const url = firebase.makePublic(await firebase.storageUpload(webpfile));
        console.log(url);
        await fileHandler.deleteFile(webpfile);

        await connection.query(
          `call InsertProduct('${data.name}', '${data.description}', ${data.price}, ${data.discount}, ${data.rating}, '${url}', ${data.stock}, ${data.brand}, ${data.category})`,
          (err, result) => {
            if (err) {
              console.error(err);
              res.json({ error: "Error fetching data", code: 400 });
              return;
            }

            if (result.affectedRows === 1) {
              res.json({ message: "Data added succesfully", code: 201 });
            }
          }
        );
      }
    }
  );

  // res.send("ok");
});
app.listen(PORT, () => {
  console.log(`Server lisening to port ${PORT}`);
});
