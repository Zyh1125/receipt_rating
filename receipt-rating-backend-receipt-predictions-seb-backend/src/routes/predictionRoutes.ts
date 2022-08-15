import express from "express";
import * as PredictionController from "../controllers/predictionController";
import { checkAuthentication } from "../middleware/middleware";

/**
 * router refers to http://localhost:8081/prediction/...route
 */
const predictionRoutes = express.Router();

predictionRoutes.get(
  "/",
  checkAuthentication,
  PredictionController.getPredictionData
);

export default predictionRoutes;
