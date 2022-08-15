import * as mongoose from "mongoose";
import { IStatistics } from "./types";

export interface User extends mongoose.Document {
  username: string;
  password: string;
  receiptStats?: IStatistics[];
  feedUsage?: any;
  appUsage?: any;
  feedStats?: any;
  predictionStats?: any;
  overviewScreenUsage?: any;
}

export const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  receiptStats: {
    type: [
      {
        receiptID: String,
        processTime: Number,
        calories: Number,
        used_products_counter_CAL: Number,
        salt: Number,
        sugar: Number,
        saturated_fat: Number,
        fat: Number,
        used_products_counter_SSFS: Number,
        addedToReceipt: [String],
        manuallyLinkedProducts: Number,
        numberlinkedProducts: Number,
        numberOfProducts: Number,
      },
    ],
    required: false,
  },
  feedUsage: {
    type: [
      {
        date: Date,
        duration: Number,
      },
    ],
    required: false,
  },
  appUsage: {
    type: [
      {
        date: Date,
        duration: Number,
      },
    ],
    required: false,
  },
  feedStats: {
    type: [
      {
        date: Date,
        amount_products: Number,
        amount_alternatives: Number,
        profile_settings: Map,
      },
    ],
    required: false,
  },
  predictionStats: {
    type: [
      {
        date: String,
        consumedCalories: Number,
        consumedFats: Number,
        consumedCarbohydrates: Number,
        consumedProteins: Number,
        consumedSalt: Number,
        consumedSugars: Number,
        consumedSaturatedFat: Number,
        referenceCalories: Number,
        referenceProteins: Number,
        referenceFats: Number,
        referenceCarbohydrates: Number,
        twoWeekAvgCalories: Number,
        twoWeekAvgProteins: Number,
        twoWeekAvgFats: Number,
        twoWeekAvgCarbohydrates: Number,
      },
    ],
    required: false,
  },
  overviewScreenUsage: {
    type: [
      {
        date: Date,
        duration: Number,
      },
    ],
    required: false,
  },
});

// This maps the internal id of the user created by mongoose to the field id
// when accessed via to JSON
UserSchema.virtual("id").get(function () {
  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  return this._id.toHexString();
});

UserSchema.set("toJSON", {
  virtuals: true,
});

//export user schema
export default mongoose.model<User>("User", UserSchema);
