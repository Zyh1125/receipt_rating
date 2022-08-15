import * as mongoose from "mongoose";

export interface ProfileInterface extends mongoose.Document {
  name: string;
  birthday: Date;
  weight: number; //Array<Date | number>[],
  height: number;
  bmi: number;
  pal: number;
  gender: String;
  numberMealsRestaurantWkly: number;
  userID: string;
  tags: Object;
  feed_categories: Object;
}

export const ProfileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: false,
  },
  birthday: {
    type: Date,
    required: false,
  },
  weight: {
    type: Number,
    required: false,
  },
  height: {
    type: Number,
    required: false,
  },
  bmi: {
    type: Number,
    required: false,
  },
  pal: {
    type: Number,
    required: false,
  },
  numberMealsRestaurantWkly: {
    type: Number,
    required: false,
  },
  gender: {
    type: String,
    required: false,
  },
  number: {
    type: Number,
    required: false,
  },
  userID: {
    type: String,
    required: true,
  },
  tags: {
    type: Object,
    required: true,
  },
  feed_categories: {
    type: Object,
    required: true,
  },
});
/* This maps the internal id of the profile
 created by mongoose to the field id when accessed via to JSON */
ProfileSchema.virtual("id").get(function () {
  // @ts-ignore
  // eslint-disable-next-line no-underscore-dangle
  return this._id.toHexString();
});

ProfileSchema.set("toJSON", {
  virtuals: true,
});

export default mongoose.model<ProfileInterface>("Profile", ProfileSchema);
