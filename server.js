const express = require('express');
const app = express()

const PORT = 5000;

app.get("/test", (req, res)=>{
    res.json({"Result" : "Working"})
})




app.listen(PORT, ()=>{
    console.log(`Server lisening to port ${PORT}`)
})