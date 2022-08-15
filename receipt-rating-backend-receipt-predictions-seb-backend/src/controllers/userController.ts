import { Request, Response } from "express";
import Userschema from "../models/user";
import bcrypt, { compareSync } from "bcrypt";
import jwt from "jsonwebtoken";
import { internalServerErrorMessage, JwtSecret } from "../config";
import FeedSchema from "../models/feed";
import ProfileSchema from "../models/profile";

export async function register(req: Request, res: Response) {
  const newUser = new Userschema(req.body.user);
  if (!newUser) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid User object",
    });
  } else if (!newUser.password) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Invalid password",
    });
  }
  try {
    //search for user with given username
    const existingUser = await Userschema.findOne({
      username: newUser.username,
    });
    if (existingUser) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Username already exists",
      });
    }
    //password hashing
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(newUser.password, salt);
    newUser.password = hashedPassword;
    //save new user into database
    let user = await newUser.save();
    //create feed object
    FeedSchema.create({
      userID: user._id,
      feed: [],
      bookmarks: [],
      ratings: [],
    });
    ProfileSchema.create({
      userID: user._id,
      // name: undefined,
      birthday: undefined,
      weight: undefined,
      // height: undefined,
      // bmi: undefined,
      pal: undefined,
      gender: undefined,
      numberMealsRestaurantWkly: undefined,
      tags: {
        vegetarian: false,
        vegan: false,
      },
      feed_categories: {
        altNutriScore: true,
        altNovaGroup: true,
      },
    });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JwtSecret,
      {
        expiresIn: 86400, // expires in 24 hours
      }
    );

    return res
      .status(200)
      .json({ token: token, message: "User was created successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function login(req: Request, res: Response) {
  const salt = bcrypt.genSaltSync(10);//-------------
  const { username, password } = req.body;
  //check for correct params
  if (!username || !password) {
    const salt = bcrypt.genSaltSync(10);//-------------
    console.log(bcrypt.hashSync('12345', salt))//--------
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing param: " + (username ? "password" : "username"),
    });
  }
  try {
    //find user
    const user = await Userschema.findOne({ username });
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }
    //check correct password
    const correctPassword = compareSync(password, user.password);
    if (!correctPassword) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Wrong password",
      });
    }
    const expirationTime = 86400; // expires in 24 hours
    // create a token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JwtSecret,
      {
        expiresIn: expirationTime, // expires in 24 hours
      }
    );

    res.status(200).json({
      token: token,
      expiresIn: expirationTime,
    });
  } catch (error) {
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function getUser(req: Request, res: Response) {
  const userID = req.query.id;
  Userschema.findById(userID)
    .exec()
    .then((user) => {
      if (!user) {
        return res.status(404).json({
          error: "Not Found",
          message: "User not found",
        });
      }
      //send out modified userobject, since we do not want to send out the password
      const requestedUser = {
        username: user.username,
        id: user._id,
      };
      return res.status(200).json(requestedUser);
    })
    .catch((error) => res.status(500).json(internalServerErrorMessage));
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    //@ts-ignore
    const userID = req.userId;
    if (!id) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No id defined",
      });
    }
    let userToBeDeleted = await Userschema.findById({ _id: id });
    if (!userToBeDeleted) {
      return res.status(404).json({
        error: "Not Found",
        message: `User with ID:${id} not found!`,
      });
    }
    if (id !== userID) {
      return res.status(403).json({
        error: "Forbidden",
        message: `You do not have the rights to delete the user with ID:${id}`,
      });
    }

    await Userschema.findByIdAndDelete(id);
    await ProfileSchema.findOneAndDelete({ userID: id });
    await FeedSchema.findOneAndDelete({ userID: id });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function logAppTime(req: Request, res: Response) {
  try {
    //@ts-ignore
    const userID = req.userId;
    const { start, end } = req.body;
    const duration = (Date.parse(end) - Date.parse(start)) / 1000;
    //console.log(start+" : "+duration+"s")

    const stats: any = {
      date: start,
      duration: duration,
    };
    let user = await Userschema.findById(userID);
    if (user) {
      user.appUsage = user.appUsage ? user.appUsage.concat(stats) : [stats];

      await Userschema.findByIdAndUpdate(userID, user);
    }

    return res.status(200).send({
      message: "logged apptime",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}

export async function logScreenTimeFeed(req: Request, res: Response) {
  try {
    //@ts-ignore
    const userID = req.userId; //"6230635ad78ad36ff448b971" //
    const { start, end } = req.body;
    const duration = (Date.parse(end) - Date.parse(start)) / 1000;
    //console.log(start+" : "+duration+"s")

    const stats: any = {
      date: start,
      duration: duration,
    };
    let user = await Userschema.findById(userID);
    if (user) {
      user.feedUsage = user.feedUsage ? user.feedUsage.concat(stats) : [stats];

      await Userschema.findByIdAndUpdate(userID, user);
    }

    return res.status(200).send({
      message: "logged screentime",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json(internalServerErrorMessage);
  }
}

  export async function logScreenTimeOverviewScreen(req: Request, res: Response) {
    try {
      //@ts-ignore
      const userID = req.userId;
      const { start, end } = req.body;
      const duration = (Date.parse(end) - Date.parse(start)) / 1000;
  
      const stats: any = {
        date: start,
        duration: duration,
      };
      let user = await Userschema.findById(userID);
      if (user) {
        user.overviewScreenUsage = user.overviewScreenUsage ? user.overviewScreenUsage.concat(stats) : [stats];
  
        await Userschema.findByIdAndUpdate(userID, user);
      }
  
      return res.status(200).send({
        message: "logged overview screentime",
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json(internalServerErrorMessage);
    }
}
