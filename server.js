//#region Requirements
const express = require("express");
const app = express();

require("dotenv").config();
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const upload = multer();
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
  //#region TODO : replace this part with the database data fetching || content : simulated data from database
  let simg =
    "https://firebasestorage.googleapis.com/v0/b/new-tech-ff9a5.appspot.com/o/Product-Images%2F4c8433b9-8c75-4ee4-9dfc-b498004f97c2.webp?alt=media&token=83004ec1-5952-43b8-bf84-e2beecce573c";
  let Iimg =
    "https://firebasestorage.googleapis.com/v0/b/new-tech-ff9a5.appspot.com/o/Product-Images%2Fca86c90b-a154-438b-b379-29bffcac23d7.webp?alt=media&token=ceaf9242-f035-479a-9b39-0917255930fe";
  const data = [
    {
      name: "Samsung Galaxy S23 ",
      img: simg,
      rating: 3.5,
      price: 350000,
      discount: 0,
      url: 1,
      status: 1,
    },
    {
      name: "Samsung Galaxy S24 Ultra",
      img: simg,
      rating: 4.7,
      price: 450000,
      discount: 2.5,
      url: 4,
      status: 0,
    },
    {
      name: "IPhone 14 Pro Max",
      img: Iimg,
      rating: 2.5,
      price: 400000,
      discount: 10,
      url: 2,
      status: 1,
    },
    {
      name: "IPhone 14",
      img: Iimg,
      rating: 3.7,
      price: 350000,
      discount: 5,
      url: 3,
      status: 1,
    },
  ];
  //#endregion
  
  res.json(data).status(200);
});

app.delete("/admin/product/delete", (req, res) => {
  const id = req.query.id
  // TODO : implement removing from the database
  res.status(200).json({state : "deleted"})
});

app.post("/admin/product/statechange", (req, res)=>{
  const id = req.body.id;
  // TODO : implement changing state from the database
  res.status(200).json({ id: id });
});

app.listen(PORT, () => {
  console.log(`Server lisening to port ${PORT}`);
});
