
const getURL = (url) => {
  return process.env.SERVER+ process.env.PORT + url;
}

module.exports = {getURL}