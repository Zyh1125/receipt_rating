import * as mongoose from "mongoose";
import { INutrients_bls } from "./types";
export interface blsInterface extends mongoose.Document {
  description: String;
  nutrients: INutrients_bls;
}
export const blsSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
  },
  nutrients: {
    type: {
      VA: { type: { value: Number } }, //? add?
    },
    required: false,
  },
});
export default mongoose.model<blsInterface>("bls", blsSchema);
