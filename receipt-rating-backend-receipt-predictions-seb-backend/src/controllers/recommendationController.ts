import { Request, Response } from "express";
import { internalServerErrorMessage } from "../config";
import UserSchema from "../models/user";
import { RecommendationService } from "../services/recommendationService";
export async function getRecommendationData(req: Request, res: Response) {
  try {
    //@ts-ignore
    const userID = req.userId;
    const recommendationService = new RecommendationService();

    const DDSResult = await recommendationService.getDDS(userID);
    //const defaultArr: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    //const DDS = await Promise.resolve(DDSResultPromise);
    const recommendation = {
      userID: userID,
      DDS: DDSResult,
      enough_Wholegrain: true,
      enough_Vegetable: false,
      enough_Fruit: false,
      consume_Sausage: true,
      consume_Snacks: true,
      consume_FastFood: false,
      is_Rapeseed: true,
      excessive_Meat: false,
      // enough_Wholegrain:
      //   RecommendationService.evaluate_wholegrain_consumption(),
      // enough_Vegetable: recommendationService.evaluate_vegetables_consumption(),
      // enough_Fruit: recommendationService.evaluate_fruit_consumption(),
      // consume_Sausage: RecommendationService.consume_sausage,
      // consume_Snacks: RecommendationService.consume_snacks,
      // consume_FastFood: RecommendationService.consume_FastFood,
      // is_Rapeseed: RecommendationService.is_Rapeseed,
      // excessive_Meat: RecommendationService.excessive_meat,
    };
    console.log(DDSResult + "???????????");

    return res.status(200).send({
      recommendation: recommendation ?? [],
      message: "Retrieved Recommendation",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}
