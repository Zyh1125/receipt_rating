import express from "express";
import * as RecommendationController from "../controllers/recommendationController";
import { checkAuthentication } from "../middleware/middleware";

/**
 * router refers http://localhost:8081/recommendation/...route
 */
const recommendationRoutes = express.Router();

recommendationRoutes.get(
  "/",
  checkAuthentication,
  RecommendationController.getRecommendationData
);

export default recommendationRoutes;
