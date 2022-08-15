import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import formData from "express-form-data";
import os from "os";
import path from "path";

import * as Constants from "./config";
import * as swaggerDocument from "./resources/swagger.json";
import userRoutes from "./routes/userRoutes";
import receiptRoutes from "./routes/receiptRoutes";
import productRoutes from "./routes/productRoutes";
import profileRoutes from "./routes/profileRoutes";
import feedRoutes from "./routes/feedRoutes";
import openfoodfactsRoutes from "./routes/openfoodfactsRoutes";
import { allowCrossDomain } from "./middleware/middleware";
import predictionRoutes from "./routes/predictionRoutes";
import recommendationRoutes from "./routes/recommendationRoutes";

mongoose
  .connect(Constants.mongoURI, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.log(
      `MongoDB connection error. Please make sure MongoDB is running. ${err}`
    );
  });
mongoose.set("useFindAndModify", false);

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const options = {
  uploadDir: os.tmpdir(),
  autoClean: true,
};

//parse formData
app.use(formData.parse(options));
app.use(formData.format());
app.use(formData.stream());
app.use(formData.union());

app.set("secretKey", Constants.JwtSecret);
app.set("port", process.env.PORT || "8081");

app.use(allowCrossDomain);

app.use(express.static("public"));
//routes
app.use("/user", userRoutes);
app.use("/receipt", receiptRoutes);
app.use("/product", productRoutes);
app.use("/profile", profileRoutes);
app.use("/feed", feedRoutes);
app.use("/recommendation", recommendationRoutes);
app.use("/prediction", predictionRoutes);
app.use("/off", openfoodfactsRoutes);
app.get("/", (request, response) => {
  //response.send('<h1>Service is running</h1>');
  response.sendFile(path.join(__dirname, "/public/index.html"));
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default app;
