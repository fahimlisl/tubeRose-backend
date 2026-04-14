import mongoose from "mongoose";
import { DB_NAME } from "../constants.ts";

const connectDB = async() => {
    try {
        await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`);
        console.log(`connection establised between mongodb`)
    } catch (error) {
        console.log("faield to build connection between datbase",error)
        throw new Error("Faield to build connection between databse!");
    }
}

export {connectDB}