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
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);
const axios = require("axios");

const DBConnect = require("./Utils/DBConnect.js");

const firebase = require("./Utils/Firebase.js");
const fileHandler = require("./Utils/fileHandler.js");
const getServerURL = require("./Utils/ServerInfo.js").getURL;

const connection = DBConnect.connect();
firebase.initialize();
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

app.use((req, res, next) => {
  if (connection.state === "disconnected") {
    res.json({ message: "no connecttion" });
    return;
  }
  next();
});
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
  connection.query(`DELETE FROM Products WHERE ID = ${id}`, (err, result) => {
    if (err) {
      req.json({ error: "Internal Server Error", code: 500 });
    } else {
      res.status(200).json({ state: "deleted", code: 200 });
    }
  });
});

app.post("/admin/product/statechange", upload.none(), (req, res) => {
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

app.post("/login/:userType", upload.none(), (req, res) => {
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
                req.session.user["isAdmin"] = true;
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
    console.error(err);
    res.status(200).json({ error: "Internal Server Error" });
  }
  return;
});

app.post("/signup", upload.none(), async (req, res) => {
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

app.get("/logout", upload.none(), (req, res) => {
  req.session.user = null;
  res.json({ logout: "success", code: 200 });
});

app.post("/cart/edit", upload.none(), (req, res) => {
  const data = req.body;
  try {
    if (data.delete !== "undefined") {
      connection.query(
        `DELETE FROM CartData where CartID = ${data.cartID} and ProductID = ${data.productID}`,
        (err, result) => {
          if (err) {
            Error("Error accessing database : \n" + err);
          }
          if (result.affectedRows === 1) {
            res.status(200).json({ updateStatus: true });
          } else {
            res.status(200).json({ updateStatus: false });
          }
        }
      );
    } else {
      connection.query(
        `UPDATE CartData SET Quantity = '${data.quantity}' WHERE (CartID = '${data.cartID}') and (ProductID = '${data.productID}');`,
        (err, result) => {
          if (err) {
            Error("Error occured Updating data : \n" + err);
          }

          if (result.affectedRows === 1) {
            res.status(200).json({ updateStatus: true });
          } else {
            res.status(200).json({ updateStatus: false });
          }
        }
      );
    }
  } catch (error) {
    console.error(error);
    res.status(200).json({ error: "Internal Server Error" });
  }
});

app.get("/cart", (req, res) => {
  let id = null;
  if (req.session.user) {
    id = req.session.user.Email;
  } else {
    id = req.query.id;
  }
  if (!id) {
    res.status(200).json({ error: "No ID sent" });
    return;
  }
  try {
    connection.query(`call GetCartPerUser('${id}');`, (err, result) => {
      if (err) {
        Error("Error fetching data : \n" + err);
      }
      if (req.session.user && result[0].length !== 0) {
        req.session.user.CartID = result[0][0].CartID;
      }
      res.status(200).json(result[0]);
    });
  } catch (err) {
    console.error(err);
    res.status(200).json({ err: "Internal Server Error" });
  }
});

app.post("/checkout/online", upload.none(), (req, res) => {
  const id = req.session.user.Email;
  axios.get(getServerURL(`/cart?id=${id}`)).then(async (result) => {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: id,
        mode: "payment",
        line_items: result.data.map((item) => {
          return {
            price_data: {
              currency: "lkr",
              product_data: {
                name: item.Name,
                images: [item.Image],
              },
              tax_behavior: "inclusive",
              unit_amount: item.Price * (100 - item.Discount),
            },
            quantity: item.Quantity,
          };
        }),
        success_url: decodeURIComponent(req.body.successURL),
        cancel_url: decodeURIComponent(req.body.cancelURL),
      });
      req.session.user.CheckoutID = session.id;
      res.json({ completed: true, url: session.url });
    } catch (error) {
      console.error(error);
      res.json({ completed: false });
    }
  });
});

app.post("/checkout/online/verify", upload.none(), async (req, res) => {
  const data = req.session.user;
  if (!data.CheckoutID || !data.CartID) {
    res.json({ error: "no CheckoutID or CardID" });
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(data.CheckoutID);

    connection.query(
      `CALL CheckoutOnlineVerify('${data.CartID}', '${session.payment_intent}');`,
      (err, result) => {
        if (err) {
          Error("Error fetching from database : \n" + err);
        } else {
          req.session.user.CheckoutID = null;
          req.session.user.CartID = null;
          if (result.affectedRows === 1) {
            res.json({ updated: true });
          } else {
            res.json({ updated: false });
          }
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.json({ error: "Internal Server Error" });
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
        const url = firebase.makePublic(
          await firebase.storageUpload(webpfile, true)
        );
        await fileHandler.deleteFile(webpfile);

        await connection.query(
          `call InsertProduct('${data.name}', '${data.description}', ${data.price}, ${data.discount}, '${url}', ${data.stock}, ${data.brand}, ${data.category})`,
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
});

app.get("/admin/product/details", upload.none(), (req, res) => {
  connection.query(
    `SELECT * FROM Products WHERE ID = ${req.query.id}`,
    (err, result) => {
      if (err) {
        console.error(err);
        res.json({ error: "Internal Server Error", code: 500 });
      } else {
        res.json(result[0]);
      }
    }
  );
});

app.post("/admin/product/update", upload.single("image"), async (req, res) => {
  let url = null;
  if (req.file !== undefined) {
    const webpFile = await fileHandler.convert2webp(req.file);
    url = firebase.makePublic(await firebase.storageUpload(webpFile, true));
    await fileHandler.deleteFile(webpFile);
  } else {
    url = req.body.image;
  }

  const data = req.body;
  connection.query(
    `Call UpdateItem(${data.id}, '${data.description}', ${data.price}, ${data.discount}, '${url}', ${data.stock})`,
    (err, result) => {
      if (err) {
        console.error(err);
        res.json({ error: "Inyernal Server Error", code: 500 });
      } else {
        res.json({ message: "Product Updated Successfully", code: 200 });
      }
    }
  );
});

app.post("/checkout/online/cancel", upload.none(), async (req, res) => {
  const data = req.session.user;
  if (data) {
    data.CartID = null;
    data.CheckoutID = null;
  }
});

app.post("/checkout/bank", upload.single("image"), async (req, res) => {
  const data = req.session.user;
  const file = await fileHandler.convert2webp(req.file);
  const url = firebase.makePublic(await firebase.storageUpload(file, false));

  fileHandler.deleteFile(file);

  connection.query(
    `CALL CheckoutBankVerify(${data.CartID}, '${url}')`,
    (err, result) => {
      if (err) {
        console.error(err);
        res.json({ error: "Error entering data to the database" });
      } else {
        res.json({ message: "Updated Successfully", code: 200 });
      }
    }
  );
});

app.post("/search", upload.none(), (req, res) => {
  const data = req.body;

  let query = `SELECT * FROM Products WHERE NAME LIKE '%${data.term}%' AND Rating >= ${data.rating} AND Price <=${data.price}`;
  if (!data.isAdmin) {
    query += " AND STATUS=1";
  }
  if (data.brands !== "") {
    query += ` AND Brand IN (${data.brands})`;
  }
  if (data.categories !== "") {
    query += ` AND Category IN (${data.categories})`;
  }
  if (data.status !== "") {
    query += ` AND Status = ${data.status}`;
  }
  connection.query(query, (err, result) => {
    if (err) {
      console.error(err);
    } else {
      res.json(result);
    }
  });
});

app.get("/admin/approvals/:type", upload.none(), (req, res) => {
  connection.query("CALL GetPendingApprovals()", (err, result1) => {
    if (err) {
      res.json({ error: "Interval Server Error" });
    } else {
      if (req.params.type === "count") {
        res.json({ length: result1[0].length });
      } else {
        connection.query("CALL GetApprovalItems()", (err, result2) => {
          if (err) {
            res.json({ error: "Interval Server Error" });
          } else {
            result1 = result1[0];
            result2 = result2[0];
            let pendingApprovals = {};

            result1.forEach((result) => {
              result.Items = [];
              pendingApprovals[result.CartID] = result;
            });

            result2.forEach((result) => {
              pendingApprovals[result.CartID].Items.push(result);
            });
            let finalResult = Object.values(pendingApprovals);

            finalResult.forEach((element) => {
              let total = 0;
              let discount = 0;
              element.Items.forEach((item) => {
                total += item.Price * item.Quantity;
                discount +=
                  ((item.Price * item.Discount) / 100) * item.Quantity;
              });
              element.TotalPrice = total - discount;
              element.Discount = discount;

              let date = element.PayDate.toLocaleDateString("zh-Hans-CN");
              let time = element.PayDate.toTimeString().split(" ")[0];

              element.PayDate = date + "T" + time;
            });
            res.json(finalResult);
          }
        });
      }
    }
  });
});

app.post("/admin/approvals/:state", upload.none(), (req, res) => {
  connection.query(
    `CALL ApproveItem('${req.params.state}', '${req.body.CartID}')`,
    (err, result) => {
      if (err) {
        console.error(err);
        res.json({ error: "Internal Server Error", code: 500 });
      } else {
        res.json({ message: "Executed successfully", code: 200 });
      }
    }
  );
});

app.get("/admin/pickup/:type", upload.none(), (req, res) => {
  connection.query("CALL GetPendingPickup()", (err, result1) => {
    if (err) {
      res.json({ error: "Interval Server Error" });
    } else {
      if (req.params.type === "count") {
        res.json({ length: result1[0].length });
      } else {
        connection.query("CALL GetPickUpItems()", (err, result2) => {
          if (err) {
            res.json({ error: "Interval Server Error" });
          } else {
            result1 = result1[0];
            result2 = result2[0];
            let pendingApprovals = {};

            result1.forEach((result) => {
              result.Items = [];
              pendingApprovals[result.CartID] = result;
            });

            result2.forEach((result) => {
              pendingApprovals[result.CartID].Items.push(result);
            });
            let finalResult = Object.values(pendingApprovals);

            finalResult.forEach((element) => {
              let total = 0;
              let discount = 0;
              element.Items.forEach((item) => {
                total += item.Price * item.Quantity;
                discount +=
                  ((item.Price * item.Discount) / 100) * item.Quantity;
              });
              element.TotalPrice = total - discount;
              element.Discount = discount;

              let date = element.PayDate.toLocaleDateString("zh-Hans-CN");
              let time = element.PayDate.toTimeString().split(" ")[0];

              element.PayDate = date + "T" + time;
            });
            res.json(finalResult);
          }
        });
      }
    }
  });
});

app.post("/admin/pickup", upload.none(), (req, res) => {
  connection.query(
    `CALL SetPickUp('${req.body.CartID}')`,
    (err, result) => {
      if (err) {
        console.error(err);
        res.json({ error: "Internal Server Error", code: 500 });
      } else {
        res.json({ message: "Executed successfully", code: 200 });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server lisening to port ${PORT}`);
});
