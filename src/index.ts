import app from "./app.ts"
import dotenv from "dotenv"
import { connectDB } from "./db/index.ts";

dotenv.config({
  path:"./.env"
})

connectDB()
.then(() => {
  app.get("/",(req,res) => {
    res.send("bckend is running with typescirpt!");
  })
  app.listen(process.env.PORT || 3009, () => {
    console.log(`app is listening on port ${process.env.PORT}!`)
  })
})
.catch((error) => {
  console.log("got error while connecting to datbase! backend server wasn't able to start");
  process.exit(1)
})