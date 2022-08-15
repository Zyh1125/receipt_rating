import { Request, Response } from "express";
import { badRequestErrorMessage, internalServerErrorMessage } from "../config";
import ProfileSchema, { ProfileInterface } from "../models/profile";
import { IProfile, IReceipt } from "../models/types";
import UserSchema from "../models/user";

export async function createProfile(req: Request, res: Response) {
  const { profile } = req.body;
  try {
    //@ts-ignore
    const userID = req.userId; // user id fest setzen fürs testen "61dc3937c8aaadee20b1cbcc" //

    console.log(userID);

    if (!profile) {
      return res
        .status(400)
        .json(badRequestErrorMessage("Profile information missing from body"));
    }

    let newProfile: IProfile = {
      /* name: profile.name,
            
            
            height: profile.height,
            bmi: profile.bmi,
            */
      birthday: profile.birthday ?? new Date(),
      weight: profile.weight,
      pal: profile.pal,
      gender: profile.gender,
      numberMealsRestaurantWkly: profile.numberMealsRestaurantWkly,
      userID: userID,
      tags: profile.tags,
      feed_categories: profile.feed_categories,
    };

    console.log(newProfile);

    let p = await new ProfileSchema(newProfile).save();

    return res.status(200).send({
      message: "Saved Profile",
      profile: p,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function updateProfile(req: Request, res: Response) {
  const { profile } = req.body;
  try {
    //@ts-ignore
    const userID = req.userId;

    if (!profile) {
      return res
        .status(400)
        .json(badRequestErrorMessage("Profile information missing from body"));
    }

    let updatedProfile: IProfile = {
      /* name: profile.name ? profile.name : undefined,
            height: profile.height ? profile.height : undefined,
            bmi: profile.bmi ? profile.bmi : undefined, */
      birthday: profile.birthday ? profile.birthday : undefined,
      weight: profile.weight ? profile.weight : undefined,
      pal: profile.pal ? profile.pal : undefined,
      gender: profile.gender ? profile.gender : undefined,
      numberMealsRestaurantWkly: profile.numberMealsRestaurantWkly
        ? profile.numberMealsRestaurantWkly
        : undefined,
      userID: userID,
      tags: profile.tags,
      feed_categories: profile.feed_categories,
    };

    let p = await ProfileSchema.findOneAndUpdate(
      {
        userID: userID,
      },
      updatedProfile,
      { returnOriginal: false }
    );

    if (!p) {
      let p = await new ProfileSchema(updatedProfile).save();
      return res.status(200).send({
        profile: p,
        message: "Created Profile",
      });
    }
    return res.status(200).send({
      profile: p,
      message: "Updated Profile",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function getProfile(req: Request, res: Response) {
  try {
    //@ts-ignore
    const userID = req.userId; //"61dc3937c8aaadee20b1cbcc"
    let profile = undefined;

    //check if admin then return all receipts - to evaluate the Userstudy
    const user = await UserSchema.findById(userID);
    if (user?.username == "esteradmin") {
      profile = await ProfileSchema.find();
    } else {
      profile = await ProfileSchema.find({
        userID: userID,
      });
    }

    return res.status(200).send({
      profile: profile[0],
      message: "Retrieved Profile",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}
