import express from "express";
import cookieParser from "cookie-parser"
import morgan from "morgan"
import dotenv from "dotenv"

dotenv.config({
    path:"./.env"
});
const app = express();
const isDev = process.env.NODE_ENV === "development"


// middlewares
app.use(morgan( isDev ? "dev" : "combined"))
app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({limit: "16kb", extended:true}))
app.use(express.static("public"))
app.use(cookieParser());



export default app;