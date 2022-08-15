import { compare } from "bcrypt";
import { Request, Response } from "express";
import { internalServerErrorMessage } from "../config";
import UserSchema from "../models/user";
import { PredictionService } from "../services/predictionService";

export async function getPredictionData(req: Request, res: Response) {
  try {
    //@ts-ignore
    const userID = req.userId; // "629b3a21a2dd50654a9b7244";

    const predictionService = new PredictionService();

    const predictionResultPromise =
      await predictionService.predictWeeklyConsumption(userID);

    const defaultArr: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const resultReceipt =
      (await Promise.resolve(predictionResultPromise)) || defaultArr;

    const predictions = {
      userID: userID,
      consumedCalories: resultReceipt[0].toFixed(0),
      consumedFats: resultReceipt[1].toFixed(0),
      consumedCarbohydrates: resultReceipt[2].toFixed(0),
      consumedProteins: resultReceipt[3].toFixed(0),
      consumedSalt: resultReceipt[4].toFixed(2),
      consumedSodium: resultReceipt[5].toFixed(2),
      consumedSugars: resultReceipt[6].toFixed(0),
      consumedSaturatedFat: resultReceipt[7].toFixed(2),
      referenceCalories: resultReceipt[8].toFixed(0),
      referenceProteins: resultReceipt[9].toFixed(0),
      referenceFats: resultReceipt[10].toFixed(0),
      referenceCarbohydrates: resultReceipt[11].toFixed(0),
    };

    let user = await UserSchema.findById(userID);
    if (user) {
      const predictionStats = {
        date: new Date(),
        consumedCalories: resultReceipt[0].toFixed(0),
        consumedFats: resultReceipt[1].toFixed(0),
        consumedCarbohydrates: resultReceipt[2].toFixed(0),
        consumedProteins: resultReceipt[3].toFixed(0),
        consumedSalt: resultReceipt[4].toFixed(2),
        consumedSugars: resultReceipt[6].toFixed(0),
        consumedSaturatedFat: resultReceipt[7].toFixed(2),
        referenceCalories: resultReceipt[8].toFixed(0),
        referenceProteins: resultReceipt[9].toFixed(0),
        referenceFats: resultReceipt[10].toFixed(0),
        referenceCarbohydrates: resultReceipt[11].toFixed(0),
        twoWeekAvgCalories: resultReceipt[12].toFixed(0),
        twoWeekAvgProteins: resultReceipt[13].toFixed(0),
        twoWeekAvgFats: resultReceipt[14].toFixed(0),
        twoWeekAvgCarbohydrates: resultReceipt[15].toFixed(0),
      };

      user.predictionStats = user.predictionStats
        ? user.predictionStats.concat(predictionStats)
        : [predictionStats];

      await UserSchema.findByIdAndUpdate(userID, user);
    }

    return res.status(200).send({
      predictions: predictions ?? [],
      message: "Retrieved Predictions",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}
