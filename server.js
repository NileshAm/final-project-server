//#region Requirements
const express = require("express");
const app = express();

require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer();

const DBConnect = require("./Utils/DBConnect.js");
const connection = DBConnect.connect();
//#endregion

//#region middleware
app.use(upload.none());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

app.use(
  cors({
    origin: process.env.ORIGIN,
    methods: ["GET", "POST", "DELETE"],
  })
);
//#endregion

const PORT = process.env.PORT;

app.get("/test", (req, res) => {
  res.json({ Result: "Working" });
});

app.get("/home", (req, res) => {
 
  connection.query("SELECT * FROM Products WHERE Status=1", (err, result)=>{
    if(err){
      console.error(`Error fetching data : \n${err}`);
      res.status(500).json({ error: "Failed to execute Query" });
    }else{
      res.status(200).json(result)
    }
  })
});

app.delete("/admin/product/delete", (req, res) => {
  const id = req.query.id;
  // TODO : implement removing from the database
  res.status(200).json({ state: "deleted" });
});

app.post("/admin/product/statechange", (req, res) => {
  const id = req.body.id;
  
  connection.query(`update Products set Status = not(Status) where ID=${id};`, (err, result)=>{
    if(err){
      console.error(`Error fetching data : \n${err}`);
      res.status(500).json({ error: "Failed to execute Query" });
    }else{
      res.status(200).json({ id: id });

    }
  });

});

app.post("/login/:userType", (req, res) => {
  const type = req.params.userType;
  const data = req.body;
  connection.query(
    `SELECT count(*) AS Users FROM Login WHERE Username='${data.username}' AND Password='${data.password}'`,
    (err, result) => {
      if (err) {
        console.error(`Error fetching data : \n${err}`);
        res.status(500).json({ error: "Failed to execute Query" });
      } else {
        if (result[0].Users === 1) {
          if (type === "admin" && data.username === "Admin") {
            res.status(200).json({ Access: "Granted", redirect: "/admin" });
          } else {
            res.status(200).json({ Access: "Granted" });
          }
        } else {
          res.status(403).json({ Access: "Denied" });
        }
      }
    }
  );
});


app.listen(PORT, () => {
  console.log(`Server lisening to port ${PORT}`);
});
