require("dotenv").config();
const admin = require("firebase-admin");
let bucket = null;

const initialize = () => {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.PROJECT_ID,
    private_key_id: process.env.PRIVATE_KEY_ID,
    private_key: process.env.PRIVATE_KEY,
    client_email: process.env.CLIENT_EMAIL,
    client_id: process.env.CLIENT_ID,
    auth_uri: process.env.AUTH_URI,
    token_uri: process.env.TOKEN_URI,
    auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
    universe_domain: "googleapis.com",
  };

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: "new-tech-ff9a5.appspot.com",
    });
    bucket = admin.storage().bucket();
    console.log("Connected to firebase storage successfully");
    return admin;
  } catch (error) {
    console.error("Error connecting to firebase storage : \n" + error);
  }
};

const storageUpload = async (file) => {

  const destination = "NIBM-Final/Product-Images/" + file.filename;
  try {
    await bucket.upload(file.path, {
      destination: destination,
      metadata: {
        contentType: file.mimetype,
      },
    });
    return destination;
  } catch (error) {
    console.error("Error uploading file : \n" + error);
  }
};

const makePublic = (destination) => {
  const file = bucket.file(destination);
  file.makePublic();
  return file.publicUrl();
};

module.exports = {
  initialize,
  storageUpload,
  makePublic
};
