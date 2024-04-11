const webpConverter = require("webp-converter");
const fs = require("fs")

const convert2webp = async (file) => {
    const webpPath = file.path.split(".")[0]+".webp"
    await webpConverter.cwebp(file.path, webpPath, "-q 80")
    deleteFile(file)
    let wfile = file
    wfile.mimetype = "image/webp"
    wfile.filename = file.filename.split(".")[0]+".webp"
    wfile.path = webpPath
    return wfile
}

const deleteFile = async (file) =>{
    fs.unlinkSync(file.path)
}


module.exports = {convert2webp, deleteFile}