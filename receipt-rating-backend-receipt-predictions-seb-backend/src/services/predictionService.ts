import ProductSchema, { ProductInterface } from "../models/product";
import ProfileSchema from "../models/profile";
import receipt from "../models/receipt";
import ReceiptSchema, { ReceiptInterface } from "../models/receipt";

/**
 *
 */
export class PredictionService {
  protected category2durability: Map<string, number>;
  protected category2DailyConsumption: Map<string, number>;

  /**
   *
   */
  constructor() {
    this.category2durability = new Map<string, number>();
    this.category2DailyConsumption = new Map<string, number>();
    this.initiateCategory2durability();
    this.initiateCategory2DailyConsumption();
  }

  /**
   *
   * @param userID
   * calculates nutritional data for all receipts of a user
   */
  async predictWeeklyConsumption(userID: string): Promise<number[] | null> {
    let result: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const defaultArr: number[] = [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const receipts = await ReceiptSchema.find({ userID: userID });
    for (let receipt of receipts) {
      let resultReceiptPromise = await this.calculateNutritionDataPerReceipt(
        receipt
      );
      const resultReceipt =
        (await Promise.resolve(resultReceiptPromise)) || defaultArr;
      // consumed Calories
      result[0] += resultReceipt[0];
      // consumed Fats
      result[1] += resultReceipt[1];
      // consumed Carbohydrates
      result[2] += resultReceipt[2];
      // consumed Proteins
      result[3] += resultReceipt[3];

      // consumed Salt
      result[4] += resultReceipt[4];
      // consumed Sodium
      result[5] += resultReceipt[5];
      // consumed Sugars
      result[6] += resultReceipt[6];
      // consumed Saturated Fat
      result[7] += resultReceipt[7];

      const todayInDays = Math.floor(
        new Date().getTime() / (1000 * 60 * 60 * 24)
      );
      const dateOfPurchaseInDays = Math.floor(
        receipt.date.getTime() / (1000 * 60 * 60 * 24)
      );

      // console.log("todayInDays: ", todayInDays);
      // console.log("dateOfPurchaseInDays: ", dateOfPurchaseInDays);
      if (todayInDays - 14 <= dateOfPurchaseInDays) {
        const twoWeeksAverageValuesPromise =
          await this.calculateAverageTwoWeeks(receipt);

        const twoWeeksAverageValues =
          (await Promise.resolve(twoWeeksAverageValuesPromise)) || defaultArr;

        // console.log("twoWeeksAverageValues:", twoWeeksAverageValues);

        result[12] += twoWeeksAverageValues[0];
        result[13] += twoWeeksAverageValues[1];
        result[14] += twoWeeksAverageValues[2];
        result[15] += twoWeeksAverageValues[3];
      }
    }

    const restaurantNutritionValues =
      await this.calculateNutritionValuesRestaurantMeals(userID);

    // Restaurant Calories
    result[0] += restaurantNutritionValues[0];
    // Restaurant Fats
    result[1] += restaurantNutritionValues[1];
    // Restaurant Carbohydrates
    result[2] += restaurantNutritionValues[2];
    // Restaurant Proteins
    result[3] += restaurantNutritionValues[3];

    // Restaurant Salt
    result[4] += restaurantNutritionValues[4];
    // Restaurant Sugar
    result[6] += restaurantNutritionValues[5];
    // Restaurant Saturated Fat
    result[7] += restaurantNutritionValues[6];

    const referenceNutritionValues = await this.recommendNutritionValues(
      userID
    );
    // reference Calories
    result[8] = referenceNutritionValues[0];
    // reference Proteins
    result[9] = referenceNutritionValues[1];
    // reference Fats
    result[10] = referenceNutritionValues[2];
    // reference Carbs
    result[11] = referenceNutritionValues[3];

    return result;
  }

  /**
   *
   * @param receipt
   * @returns
   */
  async calculateAverageTwoWeeks(
    receipt: ReceiptInterface
  ): Promise<number[] | null> {
    let result: number[] = [0, 0, 0, 0];
    for (let receiptProduct of receipt.products) {
      const product = await Promise.resolve(
        ProductSchema.findById(receiptProduct.product)
      );

      if (product) {
        const totalWeight = this.getTotalWeight(
          product,
          receiptProduct.amount,
          receiptProduct.unit
        );

        const caloriesPer100G = product.nutriments.energy_kcal_100g || 0;
        const caloriesTwoWeeksAverage =
          ((caloriesPer100G / 100) * totalWeight) / 14;

        const proteinsPer100G = product.nutriments.proteins_100g || 0;
        const proteinsTwoWeeksAverage =
          ((proteinsPer100G / 100) * totalWeight) / 14;

        const fatsPer100G = product.nutriments.fat_100g || 0;
        const fatsTwoWeeksAverage = ((fatsPer100G / 100) * totalWeight) / 14;

        const carbohydratesPer100G = product.nutriments.carbohydrates_100g || 0;
        const carbohydratesTwoWeeksAverage =
          ((carbohydratesPer100G / 100) * totalWeight) / 14;

        result[0] += caloriesTwoWeeksAverage * 7;
        result[1] += proteinsTwoWeeksAverage * 7;
        result[2] += fatsTwoWeeksAverage * 7;
        result[3] += carbohydratesTwoWeeksAverage * 7;
      }
    }

    return result;
  }

  /**
   *
   * @param receipt
   * Calculates for each product the nutritional data and differentiates
   * between long lasting and perishable products based on durability
   */
  async calculateNutritionDataPerReceipt(
    receipt: ReceiptInterface
  ): Promise<number[] | null> {
    const MINIMUM_DAYS_EDIBLE = 15;
    let result: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    // // console.log("JJ: ", receipt.store);

    for (let receiptProduct of receipt.products) {
      // Determine minimum days edible
      const product = await Promise.resolve(
        ProductSchema.findById(receiptProduct.product)
      );

      if (product) {
        let resultProduct: number[];
        if (this.getDaysEdibleOfProduct(product) < MINIMUM_DAYS_EDIBLE) {
          resultProduct = this.calculateNutritionDataPerPerishableProduct(
            product,
            receipt.date,
            receiptProduct.amount,
            receiptProduct.unit
          );
        } else {
          resultProduct = this.calculateNutritionDataPerLongLastingProduct(
            product,
            receipt.date,
            receiptProduct.amount,
            receiptProduct.unit
          );
        }
        // console.log(product.productName + ": ", resultProduct);
        result[0] += resultProduct[0];
        result[1] += resultProduct[1];
        result[2] += resultProduct[2];
        result[3] += resultProduct[3];

        result[4] += resultProduct[4];
        result[5] += resultProduct[5];
        result[6] += resultProduct[6];
        result[7] += resultProduct[7];
      }
    }
    return result;
  }

  /**
   *
   * @param product
   * @param date_of_purchase
   * @param amount
   * @param unit
   *
   * Calculates how many calories, proteins, fats, carbohydrates, sugar, salt, saturated fats the consumer consumed
   *  in the last week of this product for long lasting products e.g. noodles, rice ...
   */
  calculateNutritionDataPerLongLastingProduct(
    product: ProductInterface,
    date_of_purchase: Date,
    amount: number,
    unit: String
  ): number[] {
    let result: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    let totalWeight = this.getTotalWeight(product, amount, unit);

    const averageDailyConsumption =
      this.getAverageDailyConsumptionOfProduct(product);

    const daysToPossibleConsumeProduct = totalWeight / averageDailyConsumption;

    const daysEdible = this.getDaysEdibleOfProduct(product);

    const daysToConsumeProduct =
      daysEdible >= daysToPossibleConsumeProduct
        ? daysToPossibleConsumeProduct
        : daysEdible;

    const countingDays = this.getCountingDays(
      date_of_purchase,
      daysToConsumeProduct
    );

    const caloriesPer100G = product.nutriments.energy_kcal_100g || 0;
    const averageCaloriesPerDay =
      (caloriesPer100G / 100) * averageDailyConsumption;

    const proteinsPer100G = product.nutriments.proteins_100g || 0;
    const averageProteinsPerDay =
      (proteinsPer100G / 100) * averageDailyConsumption;

    const fatsPer100G = product.nutriments.fat_100g || 0;
    const averageFatsPerDay = (fatsPer100G / 100) * averageDailyConsumption;

    const carbohydratesPer100G = product.nutriments.carbohydrates_100g || 0;
    const averageCarbohydratesPerDay =
      (carbohydratesPer100G / 100) * averageDailyConsumption;

    const saltPer100G = product.nutriments.salt_100g || 0;
    const averageSaltPerDay = (saltPer100G / 100) * averageDailyConsumption;

    const sodiumPer100G = product.nutriments.sodium_100g || 0;
    const averageSodiumPerDay = (sodiumPer100G / 100) * averageDailyConsumption;

    const sugarsPer100G = product.nutriments.sugars_100g || 0;
    const averageSugarsPerDay = (sugarsPer100G / 100) * averageDailyConsumption;

    const saturatedFatPer100G = product.nutriments.saturated_fat_100g || 0;
    const averageSaturatedFatPerDay =
      (saturatedFatPer100G / 100) * averageDailyConsumption;

    result[0] = averageCaloriesPerDay * countingDays;
    result[1] = averageProteinsPerDay * countingDays;
    result[2] = averageFatsPerDay * countingDays;
    result[3] = averageCarbohydratesPerDay * countingDays;

    result[4] = averageSaltPerDay * countingDays;
    result[5] = averageSodiumPerDay * countingDays;
    result[6] = averageSugarsPerDay * countingDays;
    result[7] = averageSaturatedFatPerDay * countingDays;

    return result;
  }

  /**
   *
   * @param product
   * @param date_of_purchase
   * @param amount
   * @param unit
   *
   * Calculates how many calories, proteins, fats, carbohydrates, sugar, salt, saturated fats the consumer consumed
   *  in the last week of this product for perishable products e.g. berries, apples etc.
   */
  calculateNutritionDataPerPerishableProduct(
    product: ProductInterface,
    date_of_purchase: Date,
    amount: number,
    unit: String
  ): number[] {
    let result: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    let totalWeight = this.getTotalWeight(product, amount, unit);

    const daysEdible = this.getDaysEdibleOfProduct(product);
    const countingDays = this.getCountingDays(date_of_purchase, daysEdible);

    const calories_per_day =
      (this.getCaloriesOfProductPerDay(product) / 100) * totalWeight;
    const proteins_per_day =
      (this.getProteinsOfProductPerDay(product) / 100) * totalWeight;
    const fats_per_day =
      (this.getFatsOfProductPerDay(product) / 100) * totalWeight;
    const carbohydrates_per_day =
      (this.getCarbohydratesOfProductPerDay(product) / 100) * totalWeight;

    const salt_per_day =
      (this.getSaltOfProductPerDay(product) / 100) * totalWeight;
    const sodium_per_day =
      (this.getSodiumOfProductPerDay(product) / 100) * totalWeight;
    const sugars_per_day =
      (this.getSugarsOfProductPerDay(product) / 100) * totalWeight;
    const saturatedFat_per_day =
      (this.getSaturatedFatOfProductPerDay(product) / 100) * totalWeight;

    result[0] = calories_per_day * countingDays * amount;
    result[1] = proteins_per_day * countingDays * amount;
    result[2] = fats_per_day * countingDays * amount;
    result[3] = carbohydrates_per_day * countingDays * amount;

    result[4] = salt_per_day * countingDays * amount;
    result[5] = sodium_per_day * countingDays * amount;
    result[6] = sugars_per_day * countingDays * amount;
    result[7] = saturatedFat_per_day * countingDays * amount;

    return result;
  }

  getTotalWeight(
    product: ProductInterface,
    amount: number,
    unit: String
  ): number {
    let totalWeight = 1;
    if (product.quantity) {
      if (unit === "g") {
        totalWeight = amount;
        amount = 1;
      } else if (unit === "piece") {
        const productQuantity = parseInt(
          product.quantity.replace(/[^0-9,\.\,]/g, ""),
          10
        );
        const productQuantityUnit = product.quantity
          .replace(/[0-9,\.\,]/g, "")
          .replace(" ", "");

        totalWeight = productQuantity * amount;

        // Map product Quantity to g and ml
        if (productQuantityUnit == "kg" || productQuantityUnit == "l") {
          totalWeight * 1000;
        }
      } else {
        return totalWeight;
      }
    }
    if (totalWeight > 5000) {
      return 220;
    }
    return totalWeight;
  }

  /**
   *
   * @param date_of_purchase Date of purchase
   * @param consumingDays How many days you consume the product
   * @returns How many days the consumer consumes the product
   */
  getCountingDays(date_of_purchase: Date, consumingDays: number): number {
    const todayInDays = Math.floor(
      new Date().getTime() / (1000 * 60 * 60 * 24)
    );
    const dateOfPurchaseInDays = Math.floor(
      date_of_purchase.getTime() / (1000 * 60 * 60 * 24)
    );
    const expirationDateInDays = dateOfPurchaseInDays + consumingDays;

    let countingDays = 0;

    // Date of purchase is today or in Future
    if (dateOfPurchaseInDays >= todayInDays) {
      countingDays = 0;
    }
    // Product is expired before start of last week
    else if (expirationDateInDays < todayInDays - 8) {
      countingDays = 0;
    }
    // Product bought before week started, product expires between start of last week and before today
    else if (
      dateOfPurchaseInDays < todayInDays - 8 &&
      expirationDateInDays > todayInDays - 8 &&
      expirationDateInDays < todayInDays
    ) {
      countingDays = expirationDateInDays - todayInDays + 8;
    }
    // Product bought before week started and expires after today
    else if (
      dateOfPurchaseInDays < todayInDays - 8 &&
      expirationDateInDays > todayInDays
    ) {
      countingDays = 7;
    }
    // Product bought in the week and expired after today
    else if (
      dateOfPurchaseInDays > todayInDays - 8 &&
      expirationDateInDays > todayInDays
    ) {
      countingDays = todayInDays - dateOfPurchaseInDays;
    }
    // product bought in the week and expired before today
    else if (
      dateOfPurchaseInDays > todayInDays - 8 &&
      expirationDateInDays < todayInDays
    ) {
      countingDays = consumingDays;
    }

    return countingDays;
  }

  /**
   *
   * @param product
   * @returns How many g/ml does the consumer consumes on average per day
   */
  getAverageDailyConsumptionOfProduct(product: ProductInterface): number {
    const defaultAverageDailyConsumption = 0.07;
    for (let category of product.categories) {
      if (this.category2DailyConsumption.has(category)) {
        const dailyAverageConsumption =
          this.category2DailyConsumption.get(category) ||
          defaultAverageDailyConsumption;

        return (dailyAverageConsumption * 1000) / 7;
      }
    }
    return (defaultAverageDailyConsumption * 1000) / 7;
  }

  /**
   *
   * @param product
   * @returns How long a product is edible
   */
  getDaysEdibleOfProduct(product: ProductInterface): number {
    const defaultAverageEdibleDays = 7;
    for (let category of product.categories) {
      if (this.category2durability.has(category)) {
        return (
          this.category2durability.get(category) || defaultAverageEdibleDays
        );
      }
    }
    return defaultAverageEdibleDays;
  }

  /**
   *
   * @param product
   * @returns
   */
  getCaloriesOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalCalories = product.nutriments.energy_kcal_100g || 0;
    return totalCalories / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getProteinsOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalProteins = product.nutriments.proteins_100g || 0;
    return totalProteins / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getFatsOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalFats = product.nutriments.fat_100g || 0;
    return totalFats / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getCarbohydratesOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalCarbohydrates = product.nutriments.carbohydrates_100g || 0;
    return totalCarbohydrates / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getSaltOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalSalt = product.nutriments.salt_100g || 0;
    return totalSalt / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getSodiumOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalSodium = product.nutriments.sodium_100g || 0;
    return totalSodium / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getSugarsOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalSugars = product.nutriments.sugars_100g || 0;
    return totalSugars / daysEdible;
  }

  /**
   *
   * @param product
   * @returns
   */
  getSaturatedFatOfProductPerDay(product: ProductInterface): number {
    const daysEdible = this.getDaysEdibleOfProduct(product);
    const totalSaturatedFat = product.nutriments.saturated_fat_100g || 0;
    return totalSaturatedFat / daysEdible;
  }

  /**
   *
   * @param userID
   */
  async calculateNutritionValuesRestaurantMeals(
    userID: string
  ): Promise<Array<number>> {
    let result: number[] = [0, 0, 0, 0, 0, 0, 0];
    const profile = await ProfileSchema.findOne({ userID: userID });
    const DEFAULT_NUMBER_MEALS_RESTAURANT_WEEKLY = 3;
    const AVERAGE_CALORIES_PER_RESTAURANT_MEAL = 750;
    const AVERAGE_AMOUNT_SALT_PER_RESTAURANT_MEAL = 1;
    const AVERAGE_AMOUNT_SUGAR_PER_RESTAURANT_MEAL = 20;
    const AVERAGE_AMOUNT_SATURATEDFAT_PER_RESTAURANT_MEAL = 3;

    const numberMealsRestaurant =
      profile?.numberMealsRestaurantWkly ||
      DEFAULT_NUMBER_MEALS_RESTAURANT_WEEKLY;

    // 32% of total calorie intake comes from fats, 50% from carbohydrates and 18% from proteins
    const fatsFromRestaurantMeals =
      (0.32 * AVERAGE_CALORIES_PER_RESTAURANT_MEAL) / 9;
    const carbsFromRestaurantMeals =
      (0.5 * AVERAGE_CALORIES_PER_RESTAURANT_MEAL) / 4;
    const proteinsFromRestaurantMeals =
      (0.18 * AVERAGE_CALORIES_PER_RESTAURANT_MEAL) / 4;

    result[0] = AVERAGE_CALORIES_PER_RESTAURANT_MEAL * numberMealsRestaurant;
    result[1] = fatsFromRestaurantMeals * numberMealsRestaurant;
    result[2] = carbsFromRestaurantMeals * numberMealsRestaurant;
    result[3] = proteinsFromRestaurantMeals * numberMealsRestaurant;

    result[4] = AVERAGE_AMOUNT_SALT_PER_RESTAURANT_MEAL * numberMealsRestaurant;
    result[5] =
      AVERAGE_AMOUNT_SUGAR_PER_RESTAURANT_MEAL * numberMealsRestaurant;
    result[6] =
      AVERAGE_AMOUNT_SATURATEDFAT_PER_RESTAURANT_MEAL * numberMealsRestaurant;

    return result;
  }

  /**
   *
   * @param userID
   * @returns
   */
  async recommendNutritionValues(userID: string): Promise<Array<number>> {
    let caloriesReferenceValues: Map<number, Array<number>> = new Map<
      number,
      Array<number>
    >();
    let proteinReferenceValues: Map<number, Array<number>> = new Map<
      number,
      Array<number>
    >();
    let fatReferenceValues: Map<number, number> = new Map<number, number>();
    let carbohydrateReferenceValues: Map<number, number> = new Map<
      number,
      number
    >();

    this.initCaloriesReferenceValues(caloriesReferenceValues);
    this.initProteinReferenceValues(proteinReferenceValues);
    this.initFatReferenceValues(fatReferenceValues);
    this.initCarbohydrateReferenceValues(carbohydrateReferenceValues);

    const profile = await ProfileSchema.findOne({ userID: userID });
    const userWeight = profile?.weight || 75;
    let pal = profile?.pal ?? 1.4;
    const gender = profile?.gender || "male";

    if (pal <= 1.4) {
      pal = 1.4;
    } else if (pal >= 1.5 && pal <= 1.7) {
      pal = 1.6;
    } else if (pal >= 1.8) {
      pal = 1.8;
    }

    const today = new Date();
    const birthDate = profile?.birthday || new Date(2001, 5, 19);
    let age = today.getFullYear() - birthDate.getFullYear();
    const months = today.getMonth() - birthDate.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const referenceWeeklyCalories = await this.calculateReferenceWeeklyCalories(
      caloriesReferenceValues,
      age,
      gender,
      pal
    );
    const referenceWeeklyProteins = await this.calculateReferenceWeeklyProteins(
      proteinReferenceValues,
      age,
      gender,
      userWeight
    );
    const referenceWeeklyFats = await this.calculateReferenceWeeklyFats(
      fatReferenceValues,
      age,
      referenceWeeklyCalories
    );
    const referenceWeeklyCarbohydrates =
      await this.calculateReferenceWeeklyCarbohydrates(
        carbohydrateReferenceValues,
        age,
        referenceWeeklyCalories
      );

    const referenceNutritionVals: number[] = [0, 0, 0, 0];

    referenceNutritionVals[0] = referenceWeeklyCalories;
    referenceNutritionVals[1] = referenceWeeklyProteins;
    referenceNutritionVals[2] = referenceWeeklyFats;
    referenceNutritionVals[3] = referenceWeeklyCarbohydrates;

    return referenceNutritionVals;
  }

  async calculateReferenceWeeklyCalories(
    caloriesReferenceValues: Map<number, Array<number>>,
    age: number,
    gender: String | undefined,
    pal: number
  ): Promise<number> {
    const caloriesReferenceVals = caloriesReferenceValues.get(age) ?? [
      0, 0, 0, 0, 0, 0,
    ];

    let referenceDailyCalories = 0;
    if (gender === "male" && pal == 1.4) {
      referenceDailyCalories = caloriesReferenceVals[0];
    } else if (gender === "female" && pal == 1.4) {
      referenceDailyCalories = caloriesReferenceVals[1];
    } else if (gender === "male" && pal == 1.6) {
      referenceDailyCalories = caloriesReferenceVals[2];
    } else if (gender === "female" && pal == 1.6) {
      referenceDailyCalories = caloriesReferenceVals[3];
    } else if (gender === "male" && pal == 1.8) {
      referenceDailyCalories = caloriesReferenceVals[4];
    } else if (gender === "female" && pal == 1.8) {
      referenceDailyCalories = caloriesReferenceVals[5];
    }

    const referenceWeeklyCalories = referenceDailyCalories * 7;

    return referenceWeeklyCalories;
  }

  async calculateReferenceWeeklyProteins(
    proteinReferenceValues: Map<number, Array<number>>,
    age: number,
    gender: String | undefined,
    userWeight: number
  ): Promise<number> {
    const proteinReferenceVals = proteinReferenceValues.get(age) ?? [0, 0];

    let referenceWeeklyProteins = 0;
    if (gender === "male") {
      referenceWeeklyProteins = proteinReferenceVals[0];
    } else if (gender === "female") {
      referenceWeeklyProteins = proteinReferenceVals[1];
    }

    return referenceWeeklyProteins * userWeight * 7;
  }

  async calculateReferenceWeeklyFats(
    fatReferenceValues: Map<number, number>,
    age: number,
    referenceWeeklyCalories: number
  ): Promise<number> {
    const fatReferenceVal = fatReferenceValues.get(age) ?? 0;

    // fatReferenceVal is given in percentage
    const recommendedFatsCalories =
      (fatReferenceVal / 100) * referenceWeeklyCalories;
    // 1g fat = 9 calories https://www.nal.usda.gov/legacy/fnic/how-many-calories-are-one-gram-fat-carbohydrate-or-protein
    const recommendedFatsInGrams = recommendedFatsCalories / 9;

    return recommendedFatsInGrams;
  }

  async calculateReferenceWeeklyCarbohydrates(
    carbohydrateReferenceValues: Map<number, number>,
    age: number,
    referenceWeeklyCalories: number
  ): Promise<number> {
    const carbohydrateReferenceVal = carbohydrateReferenceValues.get(age) ?? 0;

    // carbohydrateReferenceVal is given in percentage
    const recommendedCarbsCalories =
      (carbohydrateReferenceVal / 100) * referenceWeeklyCalories;
    // 1g carbs = 4 calories https://www.nal.usda.gov/legacy/fnic/how-many-calories-are-one-gram-fat-carbohydrate-or-protein
    const recommendedCarbsInGrams = recommendedCarbsCalories / 4;

    return recommendedCarbsInGrams;
  }

  /**
   *  age:  [1,4 && male; 1,4 && female; 1,6 && male; 1,6 && female; 1,8 && male; 1,8 && female;]
   *  beginning at age 12 (as users are older than 12 years)
   * @param caloriesReferenceValues
   */
  async initCaloriesReferenceValues(
    caloriesReferenceValues: Map<number, Array<number>>
  ) {
    // caloriesReferenceValues.set(1, [1200, 1100, 1300, 1200, 0, 0]);
    // caloriesReferenceValues.set(2, [1200, 1100, 1300, 1200, 0, 0]);
    // caloriesReferenceValues.set(3, [1200, 1100, 1300, 1200, 0, 0]);
    // caloriesReferenceValues.set(4, [1400, 1300, 1600, 1500, 1800, 1700]);
    // caloriesReferenceValues.set(5, [1400, 1300, 1600, 1500, 1800, 1700]);
    // caloriesReferenceValues.set(6, [1400, 1300, 1600, 1500, 1800, 1700]);
    // caloriesReferenceValues.set(7, [1700, 1500, 1900, 1800, 2100, 2000]);
    // caloriesReferenceValues.set(8, [1700, 1500, 1900, 1800, 2100, 2000]);
    // caloriesReferenceValues.set(9, [1700, 1500, 1900, 1800, 2100, 2000]);
    // caloriesReferenceValues.set(10, [1900, 1700, 2200, 2000, 2400, 2200]);
    // caloriesReferenceValues.set(11, [1900, 1700, 2200, 2000, 2400, 2200]);
    caloriesReferenceValues.set(12, [1900, 1700, 2200, 2000, 2400, 2200]);
    caloriesReferenceValues.set(13, [2300, 1900, 2600, 2200, 2900, 2500]);
    caloriesReferenceValues.set(14, [2300, 1900, 2600, 2200, 2900, 2500]);
    caloriesReferenceValues.set(15, [2600, 2000, 3000, 2300, 3400, 2600]);
    caloriesReferenceValues.set(16, [2600, 2000, 3000, 2300, 3400, 2600]);
    caloriesReferenceValues.set(17, [2600, 2000, 3000, 2300, 3400, 2600]);
    caloriesReferenceValues.set(18, [2600, 2000, 3000, 2300, 3400, 2600]);
    caloriesReferenceValues.set(19, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(20, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(21, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(22, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(23, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(24, [2400, 1900, 2800, 2200, 3100, 2500]);
    caloriesReferenceValues.set(25, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(26, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(27, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(28, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(29, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(30, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(31, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(32, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(33, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(34, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(35, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(36, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(37, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(38, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(39, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(40, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(41, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(42, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(43, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(44, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(45, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(46, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(47, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(48, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(49, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(50, [2300, 1800, 2700, 2100, 3000, 2400]);
    caloriesReferenceValues.set(51, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(52, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(53, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(54, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(55, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(56, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(57, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(58, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(59, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(60, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(61, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(62, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(63, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(64, [2200, 1700, 2500, 2000, 2800, 2200]);
    caloriesReferenceValues.set(65, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(66, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(67, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(68, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(69, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(71, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(72, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(73, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(74, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(75, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(76, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(77, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(78, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(79, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(80, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(81, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(82, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(83, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(84, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(85, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(86, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(87, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(88, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(89, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(90, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(91, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(92, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(93, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(94, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(95, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(96, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(97, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(98, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(99, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(100, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(101, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(102, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(103, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(104, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(105, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(106, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(107, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(108, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(109, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(110, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(111, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(112, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(113, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(114, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(115, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(116, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(117, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(118, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(119, [2100, 1700, 2500, 1900, 2800, 2100]);
    caloriesReferenceValues.set(120, [2100, 1700, 2500, 1900, 2800, 2100]);
  }

  /**
   *  age:  [male, female]
     beginning at age 12 (as users are older than 12 years)
     https://www.dge.de/wissenschaft/referenzwerte/protein/

   * @param proteinReferenceValues
   */
  async initProteinReferenceValues(
    proteinReferenceValues: Map<number, Array<number>>
  ) {
    proteinReferenceValues.set(12, [0.9, 0.9]);
    proteinReferenceValues.set(13, [0.9, 0.9]);
    proteinReferenceValues.set(14, [0.9, 0.9]);
    proteinReferenceValues.set(15, [0.9, 0.8]);
    proteinReferenceValues.set(16, [0.9, 0.8]);
    proteinReferenceValues.set(17, [0.9, 0.8]);
    proteinReferenceValues.set(18, [0.9, 0.8]);
    proteinReferenceValues.set(19, [0.8, 0.8]);
    proteinReferenceValues.set(20, [0.8, 0.8]);
    proteinReferenceValues.set(21, [0.8, 0.8]);
    proteinReferenceValues.set(22, [0.8, 0.8]);
    proteinReferenceValues.set(23, [0.8, 0.8]);
    proteinReferenceValues.set(24, [0.8, 0.8]);
    proteinReferenceValues.set(25, [0.8, 0.8]);
    proteinReferenceValues.set(26, [0.8, 0.8]);
    proteinReferenceValues.set(27, [0.8, 0.8]);
    proteinReferenceValues.set(28, [0.8, 0.8]);
    proteinReferenceValues.set(29, [0.8, 0.8]);
    proteinReferenceValues.set(30, [0.8, 0.8]);
    proteinReferenceValues.set(31, [0.8, 0.8]);
    proteinReferenceValues.set(32, [0.8, 0.8]);
    proteinReferenceValues.set(33, [0.8, 0.8]);
    proteinReferenceValues.set(34, [0.8, 0.8]);
    proteinReferenceValues.set(35, [0.8, 0.8]);
    proteinReferenceValues.set(36, [0.8, 0.8]);
    proteinReferenceValues.set(37, [0.8, 0.8]);
    proteinReferenceValues.set(38, [0.8, 0.8]);
    proteinReferenceValues.set(39, [0.8, 0.8]);
    proteinReferenceValues.set(40, [0.8, 0.8]);
    proteinReferenceValues.set(41, [0.8, 0.8]);
    proteinReferenceValues.set(42, [0.8, 0.8]);
    proteinReferenceValues.set(43, [0.8, 0.8]);
    proteinReferenceValues.set(44, [0.8, 0.8]);
    proteinReferenceValues.set(45, [0.8, 0.8]);
    proteinReferenceValues.set(46, [0.8, 0.8]);
    proteinReferenceValues.set(47, [0.8, 0.8]);
    proteinReferenceValues.set(48, [0.8, 0.8]);
    proteinReferenceValues.set(49, [0.8, 0.8]);
    proteinReferenceValues.set(50, [0.8, 0.8]);
    proteinReferenceValues.set(51, [0.8, 0.8]);
    proteinReferenceValues.set(52, [0.8, 0.8]);
    proteinReferenceValues.set(53, [0.8, 0.8]);
    proteinReferenceValues.set(54, [0.8, 0.8]);
    proteinReferenceValues.set(55, [0.8, 0.8]);
    proteinReferenceValues.set(56, [0.8, 0.8]);
    proteinReferenceValues.set(57, [0.8, 0.8]);
    proteinReferenceValues.set(58, [0.8, 0.8]);
    proteinReferenceValues.set(59, [0.8, 0.8]);
    proteinReferenceValues.set(60, [0.8, 0.8]);
    proteinReferenceValues.set(61, [0.8, 0.8]);
    proteinReferenceValues.set(62, [0.8, 0.8]);
    proteinReferenceValues.set(63, [0.8, 0.8]);
    proteinReferenceValues.set(64, [0.8, 0.8]);
    proteinReferenceValues.set(65, [1.0, 1.0]);
    proteinReferenceValues.set(66, [1.0, 1.0]);
    proteinReferenceValues.set(67, [1.0, 1.0]);
    proteinReferenceValues.set(68, [1.0, 1.0]);
    proteinReferenceValues.set(69, [1.0, 1.0]);
    proteinReferenceValues.set(70, [1.0, 1.0]);
    proteinReferenceValues.set(71, [1.0, 1.0]);
    proteinReferenceValues.set(72, [1.0, 1.0]);
    proteinReferenceValues.set(73, [1.0, 1.0]);
    proteinReferenceValues.set(74, [1.0, 1.0]);
    proteinReferenceValues.set(75, [1.0, 1.0]);
    proteinReferenceValues.set(76, [1.0, 1.0]);
    proteinReferenceValues.set(77, [1.0, 1.0]);
    proteinReferenceValues.set(78, [1.0, 1.0]);
    proteinReferenceValues.set(79, [1.0, 1.0]);
    proteinReferenceValues.set(80, [1.0, 1.0]);
    proteinReferenceValues.set(81, [1.0, 1.0]);
    proteinReferenceValues.set(82, [1.0, 1.0]);
    proteinReferenceValues.set(81, [1.0, 1.0]);
    proteinReferenceValues.set(84, [1.0, 1.0]);
    proteinReferenceValues.set(85, [1.0, 1.0]);
    proteinReferenceValues.set(86, [1.0, 1.0]);
    proteinReferenceValues.set(87, [1.0, 1.0]);
    proteinReferenceValues.set(88, [1.0, 1.0]);
    proteinReferenceValues.set(89, [1.0, 1.0]);
    proteinReferenceValues.set(90, [1.0, 1.0]);
    proteinReferenceValues.set(91, [1.0, 1.0]);
    proteinReferenceValues.set(92, [1.0, 1.0]);
    proteinReferenceValues.set(93, [1.0, 1.0]);
    proteinReferenceValues.set(94, [1.0, 1.0]);
    proteinReferenceValues.set(95, [1.0, 1.0]);
    proteinReferenceValues.set(96, [1.0, 1.0]);
    proteinReferenceValues.set(97, [1.0, 1.0]);
    proteinReferenceValues.set(98, [1.0, 1.0]);
    proteinReferenceValues.set(99, [1.0, 1.0]);
    proteinReferenceValues.set(100, [1.0, 1.0]);
    proteinReferenceValues.set(101, [1.0, 1.0]);
    proteinReferenceValues.set(102, [1.0, 1.0]);
    proteinReferenceValues.set(103, [1.0, 1.0]);
    proteinReferenceValues.set(104, [1.0, 1.0]);
    proteinReferenceValues.set(105, [1.0, 1.0]);
    proteinReferenceValues.set(106, [1.0, 1.0]);
    proteinReferenceValues.set(107, [1.0, 1.0]);
    proteinReferenceValues.set(108, [1.0, 1.0]);
    proteinReferenceValues.set(109, [1.0, 1.0]);
    proteinReferenceValues.set(110, [1.0, 1.0]);
    proteinReferenceValues.set(111, [1.0, 1.0]);
    proteinReferenceValues.set(112, [1.0, 1.0]);
    proteinReferenceValues.set(113, [1.0, 1.0]);
    proteinReferenceValues.set(114, [1.0, 1.0]);
    proteinReferenceValues.set(115, [1.0, 1.0]);
    proteinReferenceValues.set(116, [1.0, 1.0]);
    proteinReferenceValues.set(117, [1.0, 1.0]);
    proteinReferenceValues.set(118, [1.0, 1.0]);
    proteinReferenceValues.set(119, [1.0, 1.0]);
    proteinReferenceValues.set(120, [1.0, 1.0]);
  }

  /**
   * // age:  [% fat of energy]
    // beginning at age 12 (as users are older than 12 years)
    // https://www.dge.de/wissenschaft/referenzwerte/fett/

   * @param fatReferenceValues
   */
  async initFatReferenceValues(fatReferenceValues: Map<number, number>) {
    fatReferenceValues.set(12, 35);
    fatReferenceValues.set(13, 35);
    fatReferenceValues.set(14, 35);
    fatReferenceValues.set(15, 30);
    fatReferenceValues.set(16, 30);
    fatReferenceValues.set(17, 30);
    fatReferenceValues.set(18, 30);
    fatReferenceValues.set(19, 30);
    fatReferenceValues.set(20, 30);
    fatReferenceValues.set(21, 30);
    fatReferenceValues.set(22, 30);
    fatReferenceValues.set(23, 30);
    fatReferenceValues.set(24, 30);
    fatReferenceValues.set(25, 30);
    fatReferenceValues.set(26, 30);
    fatReferenceValues.set(27, 30);
    fatReferenceValues.set(28, 30);
    fatReferenceValues.set(29, 30);
    fatReferenceValues.set(30, 30);
    fatReferenceValues.set(31, 30);
    fatReferenceValues.set(32, 30);
    fatReferenceValues.set(33, 30);
    fatReferenceValues.set(34, 30);
    fatReferenceValues.set(35, 30);
    fatReferenceValues.set(36, 30);
    fatReferenceValues.set(37, 30);
    fatReferenceValues.set(38, 30);
    fatReferenceValues.set(39, 30);
    fatReferenceValues.set(40, 30);
    fatReferenceValues.set(41, 30);
    fatReferenceValues.set(42, 30);
    fatReferenceValues.set(43, 30);
    fatReferenceValues.set(44, 30);
    fatReferenceValues.set(45, 30);
    fatReferenceValues.set(46, 30);
    fatReferenceValues.set(47, 30);
    fatReferenceValues.set(48, 30);
    fatReferenceValues.set(49, 30);
    fatReferenceValues.set(50, 30);
    fatReferenceValues.set(51, 30);
    fatReferenceValues.set(52, 30);
    fatReferenceValues.set(53, 30);
    fatReferenceValues.set(54, 30);
    fatReferenceValues.set(55, 30);
    fatReferenceValues.set(56, 30);
    fatReferenceValues.set(57, 30);
    fatReferenceValues.set(58, 30);
    fatReferenceValues.set(59, 30);
    fatReferenceValues.set(60, 30);
    fatReferenceValues.set(61, 30);
    fatReferenceValues.set(62, 30);
    fatReferenceValues.set(63, 30);
    fatReferenceValues.set(64, 30);
    fatReferenceValues.set(65, 30);
    fatReferenceValues.set(66, 30);
    fatReferenceValues.set(67, 30);
    fatReferenceValues.set(68, 30);
    fatReferenceValues.set(69, 30);
    fatReferenceValues.set(70, 30);
    fatReferenceValues.set(71, 30);
    fatReferenceValues.set(72, 30);
    fatReferenceValues.set(73, 30);
    fatReferenceValues.set(74, 30);
    fatReferenceValues.set(75, 30);
    fatReferenceValues.set(76, 30);
    fatReferenceValues.set(77, 30);
    fatReferenceValues.set(78, 30);
    fatReferenceValues.set(79, 30);
    fatReferenceValues.set(80, 30);
    fatReferenceValues.set(81, 30);
    fatReferenceValues.set(82, 30);
    fatReferenceValues.set(83, 30);
    fatReferenceValues.set(84, 30);
    fatReferenceValues.set(85, 30);
    fatReferenceValues.set(86, 30);
    fatReferenceValues.set(87, 30);
    fatReferenceValues.set(88, 30);
    fatReferenceValues.set(89, 30);
    fatReferenceValues.set(90, 30);
    fatReferenceValues.set(91, 30);
    fatReferenceValues.set(92, 30);
    fatReferenceValues.set(93, 30);
    fatReferenceValues.set(94, 30);
    fatReferenceValues.set(95, 30);
    fatReferenceValues.set(96, 30);
    fatReferenceValues.set(97, 30);
    fatReferenceValues.set(98, 30);
    fatReferenceValues.set(99, 30);
    fatReferenceValues.set(100, 30);
    fatReferenceValues.set(101, 30);
    fatReferenceValues.set(102, 30);
    fatReferenceValues.set(103, 30);
    fatReferenceValues.set(104, 30);
    fatReferenceValues.set(105, 30);
    fatReferenceValues.set(106, 30);
    fatReferenceValues.set(107, 30);
    fatReferenceValues.set(108, 30);
    fatReferenceValues.set(109, 30);
    fatReferenceValues.set(110, 30);
    fatReferenceValues.set(111, 30);
    fatReferenceValues.set(112, 30);
    fatReferenceValues.set(113, 30);
    fatReferenceValues.set(114, 30);
    fatReferenceValues.set(115, 30);
    fatReferenceValues.set(116, 30);
    fatReferenceValues.set(117, 30);
    fatReferenceValues.set(118, 30);
    fatReferenceValues.set(119, 30);
    fatReferenceValues.set(120, 30);
  }

  /**
   * // age:  [% carbohydrate of energy]
    // beginning at age 12 (as users are older than 12 years)
    // https://www.dge.de/wissenschaft/referenzwerte/fett/

   * @param carbohydrateReferenceValues
   */
  async initCarbohydrateReferenceValues(
    carbohydrateReferenceValues: Map<number, number>
  ) {
    carbohydrateReferenceValues.set(12, 50);
    carbohydrateReferenceValues.set(13, 50);
    carbohydrateReferenceValues.set(14, 50);
    carbohydrateReferenceValues.set(15, 50);
    carbohydrateReferenceValues.set(16, 50);
    carbohydrateReferenceValues.set(17, 50);
    carbohydrateReferenceValues.set(18, 50);
    carbohydrateReferenceValues.set(19, 50);
    carbohydrateReferenceValues.set(20, 50);
    carbohydrateReferenceValues.set(21, 50);
    carbohydrateReferenceValues.set(22, 50);
    carbohydrateReferenceValues.set(23, 50);
    carbohydrateReferenceValues.set(24, 50);
    carbohydrateReferenceValues.set(25, 50);
    carbohydrateReferenceValues.set(26, 50);
    carbohydrateReferenceValues.set(27, 50);
    carbohydrateReferenceValues.set(28, 50);
    carbohydrateReferenceValues.set(29, 50);
    carbohydrateReferenceValues.set(30, 50);
    carbohydrateReferenceValues.set(31, 50);
    carbohydrateReferenceValues.set(32, 50);
    carbohydrateReferenceValues.set(33, 50);
    carbohydrateReferenceValues.set(34, 50);
    carbohydrateReferenceValues.set(35, 50);
    carbohydrateReferenceValues.set(36, 50);
    carbohydrateReferenceValues.set(37, 50);
    carbohydrateReferenceValues.set(38, 50);
    carbohydrateReferenceValues.set(39, 50);
    carbohydrateReferenceValues.set(40, 50);
    carbohydrateReferenceValues.set(41, 50);
    carbohydrateReferenceValues.set(42, 50);
    carbohydrateReferenceValues.set(43, 50);
    carbohydrateReferenceValues.set(44, 50);
    carbohydrateReferenceValues.set(45, 50);
    carbohydrateReferenceValues.set(46, 50);
    carbohydrateReferenceValues.set(47, 50);
    carbohydrateReferenceValues.set(48, 50);
    carbohydrateReferenceValues.set(49, 50);
    carbohydrateReferenceValues.set(50, 50);
    carbohydrateReferenceValues.set(51, 50);
    carbohydrateReferenceValues.set(52, 50);
    carbohydrateReferenceValues.set(53, 50);
    carbohydrateReferenceValues.set(54, 50);
    carbohydrateReferenceValues.set(55, 50);
    carbohydrateReferenceValues.set(56, 50);
    carbohydrateReferenceValues.set(57, 50);
    carbohydrateReferenceValues.set(58, 50);
    carbohydrateReferenceValues.set(59, 50);
    carbohydrateReferenceValues.set(60, 50);
    carbohydrateReferenceValues.set(61, 50);
    carbohydrateReferenceValues.set(62, 50);
    carbohydrateReferenceValues.set(63, 50);
    carbohydrateReferenceValues.set(64, 50);
    carbohydrateReferenceValues.set(65, 50);
    carbohydrateReferenceValues.set(66, 50);
    carbohydrateReferenceValues.set(67, 50);
    carbohydrateReferenceValues.set(68, 50);
    carbohydrateReferenceValues.set(69, 50);
    carbohydrateReferenceValues.set(70, 50);
    carbohydrateReferenceValues.set(71, 50);
    carbohydrateReferenceValues.set(72, 50);
    carbohydrateReferenceValues.set(73, 50);
    carbohydrateReferenceValues.set(74, 50);
    carbohydrateReferenceValues.set(75, 50);
    carbohydrateReferenceValues.set(76, 50);
    carbohydrateReferenceValues.set(77, 50);
    carbohydrateReferenceValues.set(78, 50);
    carbohydrateReferenceValues.set(79, 50);
    carbohydrateReferenceValues.set(80, 50);
    carbohydrateReferenceValues.set(81, 50);
    carbohydrateReferenceValues.set(82, 50);
    carbohydrateReferenceValues.set(83, 50);
    carbohydrateReferenceValues.set(84, 50);
    carbohydrateReferenceValues.set(85, 50);
    carbohydrateReferenceValues.set(86, 50);
    carbohydrateReferenceValues.set(87, 50);
    carbohydrateReferenceValues.set(88, 50);
    carbohydrateReferenceValues.set(89, 50);
    carbohydrateReferenceValues.set(90, 50);
    carbohydrateReferenceValues.set(91, 50);
    carbohydrateReferenceValues.set(92, 50);
    carbohydrateReferenceValues.set(93, 50);
    carbohydrateReferenceValues.set(94, 50);
    carbohydrateReferenceValues.set(95, 50);
    carbohydrateReferenceValues.set(96, 50);
    carbohydrateReferenceValues.set(97, 50);
    carbohydrateReferenceValues.set(98, 50);
    carbohydrateReferenceValues.set(99, 50);
    carbohydrateReferenceValues.set(100, 50);
    carbohydrateReferenceValues.set(100, 50);
    carbohydrateReferenceValues.set(101, 50);
    carbohydrateReferenceValues.set(102, 50);
    carbohydrateReferenceValues.set(103, 50);
    carbohydrateReferenceValues.set(104, 50);
    carbohydrateReferenceValues.set(105, 50);
    carbohydrateReferenceValues.set(106, 50);
    carbohydrateReferenceValues.set(107, 50);
    carbohydrateReferenceValues.set(108, 50);
    carbohydrateReferenceValues.set(109, 50);
    carbohydrateReferenceValues.set(110, 50);
    carbohydrateReferenceValues.set(111, 50);
    carbohydrateReferenceValues.set(112, 50);
    carbohydrateReferenceValues.set(113, 50);
    carbohydrateReferenceValues.set(114, 50);
    carbohydrateReferenceValues.set(115, 50);
    carbohydrateReferenceValues.set(116, 50);
    carbohydrateReferenceValues.set(117, 50);
    carbohydrateReferenceValues.set(118, 50);
    carbohydrateReferenceValues.set(119, 50);
    carbohydrateReferenceValues.set(120, 50);
  }

  /**
   *
   */
  initiateCategory2durability() {
    //frozen foods, canned foods, noodles, nutella, biscuits
    //this.category2durability.set("en:Sugary snacks", 188);
    //this.category2durability.set("en:berries", 60);
    //this.category2durability.set("en:Fruits and vegetables", 9);
    //this.category2durability.set("Alimenti in scatola", 88);
    // Category2durability focuses on foods that are edible for less than 15 days
    // The main focus lies on fresh products such as meats, dairy, fruits and vegetables
    // Unit is in days
    // Propose that foods are stored correctly (in fridge)
    // for English and German categories
    // Always take the smallest amount of days (make sure that food product is still edible)
    // OpenFoodFacts categories:

    // category2durability is difficult because there are countless factors to account for: how is the product stored, e.g. at what temperature, opened or closed, what humidity, sun-light exposure etc

    // Durability of fruits:
    // https://haltbarkeit.info/obst/
    // category2durability.set("Pineapples", 4); // not a category
    this.category2durability.set("Apples", 30);
    this.category2durability.set("Äpfel", 30);
    this.category2durability.set("Apricots", 4);
    this.category2durability.set("Aprikosen", 4);
    this.category2durability.set("Pears", 6);

    this.category2durability.set("Dried fruits", 180); // https://ask.usda.gov/s/article/How-long-are-dried-fruits-safe
    this.category2durability.set("Dörrobst", 180); // https://ask.usda.gov/s/article/How-long-are-dried-fruits-safe

    this.category2durability.set("Frozen foods", 300); // https://www.offthegridnews.com/off-grid-foods/how-long-will-frozen-food-really-last-before-it-goes-bad/ https://foodwissen.de/tiefkuehlkost-haltbarkeit/
    this.category2durability.set("Tiefkühlprodukte", 300); // https://www.offthegridnews.com/off-grid-foods/how-long-will-frozen-food-really-last-before-it-goes-bad/ https://foodwissen.de/tiefkuehlkost-haltbarkeit/

    this.category2durability.set("Potato crisps", 180); // https://www.google.com/search?q=wie+lange+sind+Kartoffelchips+haltbar%3F&ei=_uTDYsjwMKuSxc8PwJC-wA4&ved=0ahUKEwjI58PnmeH4AhUrSfEDHUCID-gQ4dUDCA4&uact=5&oq=wie+lange+sind+Kartoffelchips+haltbar%3F&gs_lcp=Cgdnd3Mtd2l6EAMyBAgAEB46BwgAEEcQsAM6BggAEB4QBzoICAAQHhAHEBM6BAgAEBM6CAgAEB4QDRATOgoIABAeEAgQDRATSgQIQRgASgQIRhgAUOsEWJMUYJwWaAJwAXgBgAHUAogB1Q2SAQgxMC4xLjEuMpgBAKABAcgBCMABAQ&sclient=gws-wiz
    this.category2durability.set("Kartoffelchips", 180); // https://www.google.com/search?q=wie+lange+sind+Kartoffelchips+haltbar%3F&ei=_uTDYsjwMKuSxc8PwJC-wA4&ved=0ahUKEwjI58PnmeH4AhUrSfEDHUCID-gQ4dUDCA4&uact=5&oq=wie+lange+sind+Kartoffelchips+haltbar%3F&gs_lcp=Cgdnd3Mtd2l6EAMyBAgAEB46BwgAEEcQsAM6BggAEB4QBzoICAAQHhAHEBM6BAgAEBM6CAgAEB4QDRATOgoIABAeEAgQDRATSgQIQRgASgQIRhgAUOsEWJMUYJwWaAJwAXgBgAHUAogB1Q2SAQgxMC4xLjEuMpgBAKABAcgBCMABAQ&sclient=gws-wiz
    this.category2durability.set("Potatoes", 60); // https://www.merkur.de/leben/genuss/kartoffeln-wie-lange-haltbar-lagern-aufbewahrung-zr-90968507.html
    this.category2durability.set("Kartoffeln", 60); // https://www.merkur.de/leben/genuss/kartoffeln-wie-lange-haltbar-lagern-aufbewahrung-zr-90968507.html

    this.category2durability.set("Bakery products", 2); //https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/brot-broetchen-co-haltbarkeit-und-lagerung-58910
    this.category2durability.set("Deutsche Backwaren", 2); //https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/brot-broetchen-co-haltbarkeit-und-lagerung-58910
    this.category2durability.set("Flours", 360); // http://www.mindesthaltbarkeitsdatum.de/haltbarkeit-von-lebensmittel/haltbarkeit-von-mehl/
    this.category2durability.set("Mehle", 360); // 360

    // Fats (a bit generalistic)
    this.category2durability.set("Vegetable oils", 360); // https://www.konzelmanns.de/blog/wiki/haltbarkeit-und-aufbewahrung-von-speiseoelen/#:~:text=Kaltgepresste%20%C3%96le%20halten%20nach%20der,verschlossen%20bis%20zu%202%20Jahre.
    this.category2durability.set("Pflanzenöle", 360); // https://www.konzelmanns.de/blog/wiki/haltbarkeit-und-aufbewahrung-von-speiseoelen/#:~:text=Kaltgepresste%20%C3%96le%20halten%20nach%20der,verschlossen%20bis%20zu%202%20Jahre.
    this.category2durability.set("Butter", 45); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/butter-haltbarkeit-und-lagerung-58923
    this.category2durability.set("Margarines", 45); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/butter-haltbarkeit-und-lagerung-58923
    this.category2durability.set("Nuts", 180); // https://survivalfreedom.com/do-nuts-expire-and-how-to-extend-their-shelflife/
    this.category2durability.set("Nüsse", 180); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/nuesse-haltbarkeit-und-lagerung-58935
    this.category2durability.set("Eggs", 21); // https://www.healthline.com/nutrition/how-long-do-eggs-last#TOC_TITLE_HDR_6
    this.category2durability.set("Vogeleier", 21); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/eier-haltbarkeit-und-lagerung-58925
    this.category2durability.set("Rices", 720); // https://www.allrecipes.com/article/how-to-store-rice/#:~:text=Uncooked%20rice%20that%20is%20stored,signs%20of%20deterioration%20or%20mold.
    this.category2durability.set("Reise", 720); // https://www.merkur.de/leben/genuss/haltbarkeit-reis-gekocht-ungekocht-kuehlschrank-lagern-or-zr-91023388.html (White rice)

    this.category2durability.set("Pastas", 720); // https://www.canitgobad.net/can-pasta-go-bad/
    // could last 1 to 2 years
    this.category2durability.set("Teigwaren", 720); // https://www.pastatelli.com/blog/haltbarkeit-von-frischen-getrockneten-und-gekochten-nudeln-n81#:~:text=Nudeln%20ohne%20Ei%2C%20also%20nur,trocken%20und%20k%C3%BChl%20gelagert%20wurden.

    // store bought fruit juices, not homemade
    this.category2durability.set("Fruit juices", 100);
    this.category2durability.set("Fruchsäfte", 100); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/fruchtsaft-und-nektar-haltbarkeit-und-lagerung-58929

    //this.category2durability.set("Salty snacks", 6);
    // this.category2durability.set("Salzige Snacks", 6);

    // 180 - 360 days for chocolates, roughly 90 days for biscuits
    this.category2durability.set("Sweet snacks", 180); // https://www.stilltasty.com/articles/view/47
    this.category2durability.set("Süßer Snack", 180);

    this.category2durability.set("Sweetened beverages", 180); // http://www.eatbydate.com/drinks/how-long-does-coke-last-shelf-life-expiration-date/#:~:text=Coke%20%2D%20How%20long%20does%20Coke,if%20stored%20properly%20and%20unopened.
    this.category2durability.set("Gezuckerte Getränke", 180); // https://www.lebensmittelklarheit.de/fragen-antworten/kurzes-mindesthaltbarkeitsdatum-bei-cola#:~:text=Nach%20Herstellerinformationen%20h%C3%A4ngt%20das%20Mindesthaltbarkeitsdatum,Haltbarkeit%20als%20Cola%20mit%20Zucker.

    this.category2durability.set("Plant milks", 14); // https://www.vital.de/news/haltbarkeit-von-hafermilch-und-co-so-erkennen-sie-schlechte-milch-275.html
    this.category2durability.set("Planzenmilch", 14);

    this.category2durability.set("Yogurts", 14); //https://www.stilltasty.com/fooditems/index/18717
    this.category2durability.set("Joghurt", 14);
    this.category2durability.set("Breakfast cereals", 180);
    this.category2durability.set("Frühstückscerealien", 180); // https://www.isteshaltbar.de/wird-muesli-schlecht/
    this.category2durability.set("Cheeses", 14); // https://www.healthline.com/nutrition/how-long-does-cheese-last-in-the-fridge#:~:text=After%20opening%2C%20you%20can%20safely,soft)%20if%20you%20see%20mold.
    this.category2durability.set("Käse", 14); // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/kaese-haltbarkeit-und-lagerung-58931

    // category2durability.set("Avocadoes", 5);+
    // not a category
    // category2durability.set("Bananas", 6);
    // not a category

    this.category2durability.set("Birnen", 6);
    this.category2durability.set("Blueberries", 8);
    this.category2durability.set("Heidelbeeren", 8);
    this.category2durability.set("Blackberries", 3);
    this.category2durability.set("Brombeeren", 3);
    this.category2durability.set("Strawberries", 4); // problem: frozen strawberries are a subcategory
    this.category2durability.set("Erdbeeren", 4);
    this.category2durability.set("Figs", 4);
    this.category2durability.set("Feigen", 4);
    this.category2durability.set("Cherries", 4);
    this.category2durability.set("Kirschen", 4);
    // category2durability.set("Mandarines", 7);
    // not a category // category2durability.set("Mango", 5);
    // not a category // Meat:
    // Subcategories of Meats (just add beef, chickens, turkey and pork together to the Meats category)
    // https://haltbarkeit.info/fleisch/
    // https://www.verbraucherzentrale.de/wissen/lebensmittel/auswaehlen-zubereiten-aufbewahren/fisch-haltbarkeit-und-lagerung-58927
    this.category2durability.set("Chickens", 1);
    this.category2durability.set("Hühnchen", 1); // or Geflügel
    this.category2durability.set("Beef", 3);
    this.category2durability.set("Rind", 3);
    this.category2durability.set("Pork", 3);
    this.category2durability.set("Schwein", 3);
    this.category2durability.set("Fishes", 1); // problem with Fishes category is that Frozen fishes is a subcategory
    this.category2durability.set("Fisch", 1);
    this.category2durability.set("Breads", 4); // https://www.bzfe.de/lebensmittel/vom-acker-bis-zum-teller/brot/brot-lagerung/ problem with Breads category is that wheat bread lasts about 2 days whereas rye bread lasts almost a week
    this.category2durability.set("Brote", 4);
    this.category2durability.set("Aubergines", 5); // Vegetables: // https://haltbarkeit.info/gemuese/
    this.category2durability.set("Frisch Auberginen", 5); // immer frisch?
    this.category2durability.set("Broccoli", 3);
    this.category2durability.set("Frischer Brokkoli", 3); //
    this.category2durability.set("Cucumbers", 6);
    this.category2durability.set("Gurken", 6);
    this.category2durability.set("Green beans", 3);
    this.category2durability.set("Frische grüne Bohnen", 3); //
    this.category2durability.set("Green peas", 3);
    this.category2durability.set("Grüne Erbsen", 3);
    this.category2durability.set("Mushrooms", 4);
    this.category2durability.set("Pilze", 4);
    this.category2durability.set("Tomatoes", 5);
    this.category2durability.set("Frische Tomaten", 5);
    this.category2durability.set("Zucchini", 4);
    this.category2durability.set("Frische Zucchini", 4);
    this.category2durability.set("Leaf vegetables", 3); // Blattsalat
    this.category2durability.set("Blattgemüse", 3); // Blattsalat
    this.category2durability.set("Fresh cauliflowers", 2); // not a category
    this.category2durability.set("Blumenkohl", 2);
    // category2durability.set("Potatoes", 2); // not a category
    // category2durability.set("Parsnip", 3); 3-4 weeks
    // category2durability.set("Radishes", 3); // up to two weeks edible
    // category2durability.set("Butter beans", 3);
    // category2durability.set("Onions and their products", 3);
    // subcategories of Dairies:
    this.category2durability.set("Milks", 7);
    this.category2durability.set("Milch", 7);
    // category2durability.set("Yoghurts", 0.05); // > 2 weeks durability
    // category2durability.set("Cheeses", 0.18); // too many different types that do not match the categories of OFF database
    // category2durability.set("Eggs", 0.17); // > 2 weeks durability
  }

  /**
   *
   */
  initiateCategory2DailyConsumption() {
    this.category2DailyConsumption.set("Alimenti in scatola", 20);
    // Based on weekly consumption data in KG
    // OpenFoodFacts categories:
    // Subcategories of Meats (just add beef, chickens, turkey and pork together to the Meats category)
    // because the American as well as the German diets can be categorised as Western diets, using the average consumption of America for people living in Germany is not that far off!
    // https://stacker.com/stories/2109/what-average-american-eats-year (2019) what average American eats per year per capita:
    this.category2DailyConsumption.set("Beef", 0.42);
    this.category2DailyConsumption.set("Rind", 0.42);
    this.category2DailyConsumption.set("Pork", 0.28);
    this.category2DailyConsumption.set("Schwein", 0.28);
    // this.category2DailyConsumption.set("Prepared meats", 1.89); // Sausages, charcuteries cuites etc
    this.category2DailyConsumption.set("Fishes", 0.082);
    this.category2DailyConsumption.set("Fisch", 0.082);
    // subcategories of Poultries:
    this.category2DailyConsumption.set("Chickens", 0.4);
    this.category2DailyConsumption.set("Hühnchen", 0.4);
    this.category2DailyConsumption.set("Turkeys", 0.077);
    this.category2DailyConsumption.set("fr: Allumettes de poulet", 1.89); //

    // instead of potato crisps salty snacks category?
    this.category2DailyConsumption.set("Potato crisps", 0.058); // https://southfloridareporter.com/americans-eat-over-6-pounds-of-potato-chips-per-person-annually/
    this.category2DailyConsumption.set("Kartoffelchips", 0.058);
    this.category2DailyConsumption.set("Potatoes", 0.5);
    this.category2DailyConsumption.set("Kartoffeln", 0.5);
    this.category2DailyConsumption.set("Breads", 0.08); // https://www.ukflourmillers.org/flourbreadconsumption#:~:text=Average%20bread%20purchases%20are%20the,than%20for%20women%20(66g).
    this.category2DailyConsumption.set("Brote", 0.08); // https://www.ukflourmillers.org/flourbreadconsumption#:~:text=Average%20bread%20purchases%20are%20the,than%20for%20women%20(66g).
    this.category2DailyConsumption.set("Bakery products", 0.25); // excluding Breads https://www.statista.com/statistics/806333/europe-bread-and-bakery-production-volume-by-category/
    this.category2DailyConsumption.set("Deutsche Backwaren", 0.25); // Deutsche Backwaren is a subcategory of Bakery products
    this.category2DailyConsumption.set("Flours", 0.993); // wheat flour + corn flour + oat flour
    this.category2DailyConsumption.set("Mehle", 0.993);

    // Subcategories of Fruits based foods
    this.category2DailyConsumption.set("Fruits", 1.357); // 70.6 kg per person per year in Germany https://www.statista.com/statistics/511662/per-capita-consumption-of-fruit-germany/
    this.category2DailyConsumption.set("Früchte", 1.357); // 70.6 kg per person per year in Germany https://www.statista.com/statistics/511662/per-capita-consumption-of-fruit-germany/
    // Subcategories of Fruits: Apples, Apricots, Berries, Cherries, Citrus, Dates, Figs, Fresh fruits, Grapes, Melons, Peaches, Pears, Plums, Tropical fruits (Pineapple, Passion fruits, Avocados, Bananas, Mangoes), Pomegranates

    this.category2DailyConsumption.set("Dried fruits", 0.027); // 1.4 kg per person per year in Germany https://www.statista.com/statistics/514500/per-capita-consumption-of-dried-fruit-germany/
    this.category2DailyConsumption.set("Dörrobst", 0.027);
    // Subcategories of Dried fruits: Dried apples, Dried apricots, Dried bananas, Dried coconut, Dried cranberries, Dried figs, Dried mangoes, Dried pineapple, Dried prunes, Dried starberries, Nuts and dried fruits, Raisins

    // Frozen foods
    // subcategories: frozen breads, desserts, fishes, meats, pizzas and pies, plant-based foods (frozen vegetables and fruits), poultry
    this.category2DailyConsumption.set("Frozen foods", 0.89); // https://www.statista.com/statistics/509294/frozen-foods-per-capita-consumption-germany/
    this.category2DailyConsumption.set("Tiefkühlprodukte", 0.89);

    //Vegetables based foods:
    // Fresh vegetables:
    this.category2DailyConsumption.set("Fresh vegetables", 2.1); // 109.4 kg per person per year in Germany https://www.statista.com/statistics/511676/per-capita-consumption-of-vegetables-germany/
    this.category2DailyConsumption.set("Frisches Gemüse", 2.1);

    this.category2DailyConsumption.set("Broccoli", 0.036);
    this.category2DailyConsumption.set("Frischer Brokkoli", 0.036);
    this.category2DailyConsumption.set("Carrots", 0.181); // carrots + sweet corn
    this.category2DailyConsumption.set("Karotten", 0.181); // carrots + sweet corn
    this.category2DailyConsumption.set("Cucumbers", 0.018);
    this.category2DailyConsumption.set("Gurken", 0.018);
    this.category2DailyConsumption.set("Legumes", 0.1044); // beans, peas, lentils
    this.category2DailyConsumption.set("Hülsenfrüchte", 0.1044); // beans, peas, lentils
    this.category2DailyConsumption.set("Leaf vegetables", 0.139); // only lettuce so far
    this.category2DailyConsumption.set("Blattgemüse", 0.139);
    // Leaf vegetables: Cabbages, Cauliflowers, Leaf salads, Lettuces, Rocket, Romanesco, Spinachs, Watercress
    this.category2DailyConsumption.set("Fresh onions", 0.068);
    this.category2DailyConsumption.set("Frische Zwiebeln", 0.068);
    this.category2DailyConsumption.set("Sweet peppers", 0.06);
    this.category2DailyConsumption.set("Paprika", 0.06);
    this.category2DailyConsumption.set("Tomatoes", 0.27);
    this.category2DailyConsumption.set("Tomaten", 0.27);

    this.category2DailyConsumption.set("Pastas", 0.15); // 7.7 kg per year https://www.foodbusinessnews.net/articles/11886-worldwide-pasta-consumption-on-the-rise#:~:text=The%20United%20States%20is%20the,9%20kg%20of%20pasta%20annually.
    this.category2DailyConsumption.set("Teigwaren", 0.15);
    //category2DailyConsumption.set("Starches", 1.89);
    this.category2DailyConsumption.set("Fruit juices", 0.45); // only orange and apple juice so far
    this.category2DailyConsumption.set("Fruchsäfte", 0.45);
    this.category2DailyConsumption.set("Salty snacks", 0.077); // 4 kg per person per year in Europe https://www.esasnacks.eu/industry.php
    this.category2DailyConsumption.set("Salzige Snacks", 0.077);
    this.category2DailyConsumption.set("Sweet snacks", 0.577); // 30 kg confectioneries per person per year // SHOULD I ADD CHOCOLATES SEPERATELY? https://www.gtai.de/resource/blob/64004/e80f4dd7ccd691158b0ee2bc10f8cd6c/industry-overview-food-beverage-industry-en-data.pdf
    this.category2DailyConsumption.set("Süßer Snack", 0.577);
    // subcategories of sweet snacks are cookies, biscuits, pastries, wafers, chocolates, energy bars

    this.category2DailyConsumption.set("Sweetened beverages", 3.4); // 176,7 L per person per year https://www.statista.com/statistics/306836/us-per-capita-consumption-of-soft-drinks/
    this.category2DailyConsumption.set("Gezuckerte Getränke", 3.4);

    // subcategories of Dairies
    this.category2DailyConsumption.set("Milks", 0.89);
    this.category2DailyConsumption.set("Milch", 0.89);
    this.category2DailyConsumption.set("Plant milks", 0.01); // nut milks etc https://www.statista.com/statistics/1092559/consumption-per-person-of-plant-based-beverages-vs-fluid-milk-spain/
    this.category2DailyConsumption.set("Planzenmilch", 0.01);
    this.category2DailyConsumption.set("Yogurts", 0.05);
    this.category2DailyConsumption.set("Joghurt", 0.05);
    this.category2DailyConsumption.set("Breakfast cereals", 0.128); // https://www.statista.com/statistics/284471/weekly-uk-household-consumption-of-breakfast-cereals/
    this.category2DailyConsumption.set("Frühstückscerealien", 0.128);
    this.category2DailyConsumption.set("Cheeses", 0.18);
    this.category2DailyConsumption.set("Käse", 0.18);

    //Fats:
    this.category2DailyConsumption.set("Vegetable oils", 0.239); // only cooking oils + oils, other so far
    this.category2DailyConsumption.set("Pflanzenöle", 0.239); // only cooking oils + oils, other so far
    this.category2DailyConsumption.set("Butter", 0.023); // butter
    this.category2DailyConsumption.set("Margarines", 0.032); // butter + margarine
    this.category2DailyConsumption.set("Margarinen", 0.032); // butter + margarine

    this.category2DailyConsumption.set("Nuts", 0.073); // only peanuts + tree nuts so far
    this.category2DailyConsumption.set("Nüsse", 0.073); // only peanuts + tree nuts so far

    this.category2DailyConsumption.set("Eggs", 0.17);
    this.category2DailyConsumption.set("Vogeleier", 0.17);

    this.category2DailyConsumption.set("Rices", 0.1);
    this.category2DailyConsumption.set("Reise", 0.1);
  }
}
