import { ProductInterface } from "./product";

export interface ErrorMessage {
  error: string;
  message: string;
}

export interface IReceiptInformation {
  store?: string;
  date?: Date;
  items: ILineItem[];
  unknownItems: ILineItem[];
  totalPrice?: number;
}
export interface ILineItem {
  name: string;
  amount: number;
  unit: string;
  price: number;
}
export enum Unit {
  PIECE = "piece",
  GRAMM = "g",
}
export interface INutrients_bls {
  //new type for bls
  VA?: {
    value: Number;
  };
}

export interface IReceipt {
  title: string;
  date: Date;
  store: string;
  products: ReceiptProductInformation[];
  score: string;
  userID?: string;
  id?: string;
}

export interface IReceiptDBEntry {
  title: string;
  date: Date;
  store: string;
  products: ReceiptProductDBEntry[];
  score: string;
  userID?: string;
  id?: string;
}

export interface ReceiptProductInformation {
  name: string;
  amount: number;
  unit: string;
  price?: number;
  ignored?: boolean;
  product: ProductInformation[] | ProductInterface[] | null;
}

export interface ReceiptProductInformationIndexed
  extends ReceiptProductInformation {
  index: number;
}

export interface ReceiptProductDBEntry {
  name: string;
  amount: number;
  unit: string;
  price?: number;
  ignored?: boolean;
  product: string | null;
}

export interface ProductInformation {
  ean: string;
  id: string;
  receiptNames: string[];
  categories: string[];
  imageUrl: string | undefined;
  ingredients?: IProductIngredient[];
  ingredientsText?: string;
  ingredientsTextDE?: string;
  nutriments: INutriments;
  nutriScore: string;
  nutriScoreScore?: number;
  nutriscoreData?: INutriscoreData;
  novaGroup?: number;
  ecoscoreGrade?: string;
  quantity?: string;
  nutrientLevels?: INutrientLevel;
  brands?: string;
  labels?: string;
  productName: string;
  productNameDE: string;
}

export interface ReceiptProductObject {
  name: string;
  amount: number;
  unit: string;
}

export interface ReceiptImageServiceResponse {
  products: ReceiptProductObject[];
  products_unknown: ReceiptProductObject[];
  successful: boolean;
}

export interface INutriments {
  alcohol?: number;
  alcohol_100g?: number;
  alcohol_serving?: number;
  alcohol_unit?: string;
  carbohydrates?: number;
  carbohydrates_100g?: number;
  carbohydrates_serving?: number;
  carbohydrates_unit?: string;
  energy?: number;
  energy_kcal?: number;
  energy_kcal_100g?: number;
  energy_kcal_serving?: number;
  energy_kcal_unit?: string;
  fat?: number;
  fat_100g?: number;
  fat_serving?: number;
  fat_unit?: string;
  fruits_vegetables_nuts_estimate_from_ingredients_100g?: number;
  nova_group?: number;
  nova_group_100g?: number;
  nutrition_score_fr?: number;
  nutrition_score_fr_100g?: number;
  proteins?: number;
  proteins_100g?: number;
  proteins_serving?: number;
  proteins_unit?: string;
  salt?: number;
  salt_100g?: number;
  salt_serving?: number;
  salt_unit?: string;
  saturated_fat?: number;
  saturated_fat_100g?: number;
  saturated_fat_serving?: number;
  saturated_fat_unit?: string;
  sodium?: number;
  sodium_100g?: number;
  sodium_serving?: number;
  sodium_unit?: string;
  sugars?: number;
  sugars_100g?: number;
  sugars_serving?: number;
  sugars_unit?: string;
  calcium?: number;
  calcium_100g?: number;
  calcium_serving?: number;
  calcium_unit?: string;
  cholesterol?: number;
  cholesterol_100g?: number;
  cholesterol_serving?: number;
  cholesterol_unit?: string;
  fat_value?: number;
  fiber?: number;
  fiber_100g?: number;
  fiber_serving?: number;
  fiber_unit?: string;
  iron?: number;
  iron_100g?: number;
  iron_serving?: number;
  iron_unit?: string;
  trans_fat?: number;
  trans_fat_100g?: number;
  trans_fat_serving?: number;
  trans_fat_unit?: string;
  vitamin_a?: number;
  vitamin_a_100g?: number;
  vitamin_a_serving?: number;
  vitamin_a_unit?: string;
  vitamin_c?: number;
  vitamin_c_100g?: number;
  vitamin_c_serving?: number;
  vitamin_c_unit?: string;
}

export interface INutrientLevel {
  fat?: Level;
  salt?: Level;
  saturated_fat?: Level;
  sugars?: Level;
}

export enum Level {
  HIGH = "high",
  MODERATE = "moderate",
  LOW = "low",
}

export interface IProductIngredient {
  percent_estimate?: number;
  percent_max?: number;
  percent_min?: number;
  rank?: number;
  text: string;
  vegan?: string;
  vegetarian?: string;
}

export interface INutriscoreData {
  energy: number;
  energy_points: number;
  fiber: number;
  fiber_points: number;
  fruits_vegetables_nuts_colza_walnut_olive_oils: number;
  fruits_vegetables_nuts_colza_walnut_olive_oils_points: number;
  grade: string;
  is_beverage: number;
  is_cheese: number;
  is_fat: number;
  is_water: number;
  negative_points: number;
  positive_points: number;
  proteins: number;
  proteins_points: number;
  saturated_fat: number;
  saturated_fat_points: number;
  saturated_fat_ratio: number;
  saturated_fat_ratio_points: number;
  score: number;
  sodium: number;
  sodium_points: number;
  sugars: number;
  sugars_points: number;
}

export interface IStatistics {
  receiptID: string;
  processTime: number;
  calories: number;
  used_products_counter_CAL: number;
  salt: number;
  sugar: number;
  saturated_fat: number;
  fat: number;
  used_products_counter_SSFS: number;
  addedToReceipt: string[];
  manuallyLinkedProducts: number;
  numberlinkedProducts: number;
  numberOfProducts: number;
}

export interface IProfile {
  name?: string;
  birthday?: Date;
  weight?: number; //Array<Date | number>[],
  height?: number;
  bmi?: number;
  pal?: number;
  gender?: String;
  numberMealsRestaurantWkly?: number;
  userID?: string;
  id?: string;
  tags: any;
  feed_categories: any;

  // split up calculated properties like bmi, nutrition stats (=avg calories/day, sugar consumption, etc.)?
}

export interface IFeed {
  userID: string;
  feed: IFeedItem[];
  bookmarks: IFeedItem[];
  ratings: any;
}

enum FeedItemType {
  // Charts
  Chart_Monthly,
  Chart_Something,

  // Alternative/substitution recommendation
  Alt_PalmOil, // [product, altProduct]
  Alt_NutriScore, // [product, altProduct]
  Alt_Sugar, //
  Alt_NovaScore, //

  // Warnings
  Warn_Sugar, // could be splitted into general warning and specific product warning

  // ...
}

export interface IFeedItem {
  uid: string; // unique hash for feed item type + input product EAN + output product EAN
  date: Date; // creation date
  itemtype: string; // e.g., Chart_Monthly; Warn_Sugar
  prio: number;
  category: string;
  parameters: any; // [12,35,22,2,5] representing Nutri-Score amounts from A to E; [product_id, alt_product_id] -> alternative product recommendation
}
