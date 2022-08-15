import ProductSchema, { ProductInterface } from "../models/product";
import ProfileSchema from "../models/profile";
import blsSchema, { blsInterface } from "../models/bls";
import ReceiptSchema, { ReceiptInterface } from "../models/receipt";
import { IProfile, IReceipt } from "../models/types";
import product from "../models/product";
import bls from "../models/bls";

export class RecommendationService {
  //protected DDS: Array<Number>;
  protected count_staple;
  protected count_wholegrain;
  protected count_staple_lw;
  protected count_wholegrain_lw;
  protected is_Rapeseed; // if there is a bottle of rapeseed oil in this week's receipts
  protected excessive_meat; //if the user has consumed more than 450g meat
  protected meat_consumption;
  protected fruit_consumption;
  protected vegetables_consumption;
  protected consume_FastFood;
  protected consume_snacks;
  protected consume_sausage;
  //protected DDS_Array = new Array<number>();
  //protected userID: String;
  constructor() {
    this.fruit_consumption = new Array<number>();
    this.count_staple = new Array<String>();
    this.count_wholegrain = new Array<String>();
    this.count_staple_lw = new Array<String>();
    this.count_wholegrain_lw = new Array<String>();
    this.is_Rapeseed = false; // if there is a bottle of rapeseed oil in this week's receipts
    this.excessive_meat = false; //if the user has consumed more than 450g meat
    this.meat_consumption = new Array<number>();
    this.vegetables_consumption = new Array<number>();
    this.consume_FastFood = false;
    this.consume_snacks = false;
    this.consume_sausage = false;
  }

  getDateStr(now: any): String {
    var year = now.getFullYear(); // year
    var month = now.getMonth() + 1; // month
    var day = now.getDate(); // day
    if (day < 10) {
      day = "0" + day;
    }
    if (month < 10) {
      month = "0" + month;
    }
    return year + month + day;
  }

  formatNumber(n: any) {
    n = n.toString();
    return n[1] ? n : "0" + n;
  }

  evaluate_wholegrain_consumption() {
    //to see if more than half of the staples are whole-grain
    let enough_wholegrain = false;
    if (
      Array.from(new Set(this.count_wholegrain)).length /
        this.count_staple.length >=
      0.5
    ) {
      enough_wholegrain = true;
    }
    return enough_wholegrain;
  }
  async evaluate_meat_consumption() {
    // to see if users have consumed more than 450g meat which is excessive
    let amount = 0;
    for (let meat in this.meat_consumption) {
      amount += parseInt(meat);
    }
    if (amount > 450) {
      this.excessive_meat = true;
    }
    return this.excessive_meat;
  }
  async evaluate_fruit_consumption() {
    let amount = 0;
    for (let fruit in this.fruit_consumption) {
      amount += parseInt(fruit);
    }
    if (amount < 1050) {
      //consider the frequency of eating outside
      return false;
    } else {
      return true;
    }
  }
  evaluate_vegetables_consumption() {
    let amount = 0;
    for (let vegetable in this.vegetables_consumption) {
      amount += parseInt(vegetable);
    }
    if (amount < 1575) {
      //consider the frequency of eating outside
      return false;
    } else {
      return true;
    }
  }
  async weekly_receipts_InArray(
    userID: string
  ): Promise<ReceiptInterface[] | null> {
    //collect weekly receipts
    let receipts_InArray: ReceiptInterface[] = [];
    const now = new Date();
    const currentDayOfWeek = now.getDay() == 0 ? 6 : now.getDay() - 1;
    var startTime_InString = this.getDateStr(
      new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000) //use format year/month/day, to compare date
    );
    // get receipts
    console.log("receipt 0");
    const receipts = await ReceiptSchema.find({ userID: userID });
    console.log("receipt 1");
    for (let receipt of receipts) {
      let newArr = [];
      newArr.push(receipt.date.getFullYear());
      newArr.push(this.formatNumber(receipt.date.getMonth() + 1)); // January = 0
      newArr.push(this.formatNumber(receipt.date.getDate()));
      const receiptTime_InString =
        newArr[0].toString() + newArr[1].toString() + newArr[2].toString();
      if (receiptTime_InString >= startTime_InString) {
        //if the receipt time is after the start time that means the receipt should be collected
        receipts_InArray.push(receipt);
      }
    }
    return receipts_InArray;
  }
  async collectProducts(userID: string): Promise<ProductInterface[] | null> {
    let consume_meat = false;
    let consume_fat = false;
    let consume_snacksAndSweets = false;
    let consume_softDrinks = false;
    let consume_alcohol = false;
    this.count_staple = new Array(); //add all of the staple into the array (with duplicate), to calculate the amount of staple
    this.count_wholegrain = new Array(); // add all of the whole-grain products into the array(without duplicate), to count the amount of whole grains
    const receipts = await Promise.resolve(
      this.weekly_receipts_InArray(userID)
    );
    let products_InList: any = [];
    let test: any = [1, 2];
    if (receipts != null) {
      receipts.forEach(async (receipt: any) => {
        // get product information
        receipt.products.forEach(async (product: any) => {
          if (product.product != "") {
            //for each object product to see if the property product of product is ""
            products_InList.push(product.product);
          }
        });
      });
    }
    return products_InList;
  }
  async calculateDDS(
    products_InList: any[],
    userID: string,
    DDS_Array: number[]
  ): Promise<number[] | null> {
    console.log("first step");
    for (var p1 of products_InList) {
      console.log("in-new");
      let p = await ProductSchema.findById(p1);
      console.log(p?.productName);
      console.log("in1-new");
      if (p != null) {
        if (
          p.productNameDE?.includes("ollkorn") ||
          p.productName?.includes("ollkorn")
        ) {
          this.count_wholegrain.push(p.productName);
        }
        if (
          p.productNameDE?.includes("apsöl") ||
          p.productName?.includes("apsöl")
        ) {
          this.is_Rapeseed = true;
        }
        for (var category of p.categories) {
          console.log("in2");
          if (p != null) {
            if (category.includes("Rapeseed oils")) {
              this.is_Rapeseed = true;
            }
            switch (category) {
              case "Frisches Gemüse":
              case "Tiefkühl-Gemüse":
              case "Vegetables":
                if (p?.quantity != null) {
                  this.vegetables_consumption.push(parseInt(p?.quantity, 10));
                }
                let vegetable = await blsSchema.findOne({
                  //see if productname is identical with the description
                  description: p.productName,
                }); //make vegetable visible to the code vegetable?.nutrients.vitamin_a_100g
                if (p.ingredientsText != undefined) {
                  console.log("executed");
                  let vegetable_d = await blsSchema.findOne({
                    description: p.ingredientsText.toString(),
                  });
                  if (vegetable == null) {
                    vegetable = vegetable_d;
                  }
                }
                //console.log("--------------");
                //console.log(vegetable);
                if (vegetable?.nutrients?.VA?.value != undefined) {
                  console.log("------");
                  if (vegetable?.nutrients?.VA?.value >= 1.35) {
                    DDS_Array[1] = 1;
                  } else {
                    DDS_Array[2] = 1;
                  }
                } else {
                  DDS_Array[2] = 1;
                }
                console.log(DDS_Array);
                break;
              case "Früchte":
              case "Fruits":
                if (p?.quantity != null) {
                  this.fruit_consumption.push(parseInt(p?.quantity, 10));
                }
                let fruit = await blsSchema.findOne({
                  //see if productname is identical with the description
                  description: p.productName,
                }); //make fruit visible to the code fruit?.nutrients.vitamin_a_100g
                if (p.ingredientsText != undefined) {
                  console.log("executed");
                  let fruit_d = await blsSchema.findOne({
                    description: p.ingredientsText.toString(),
                  });
                  if (fruit == null) {
                    fruit = fruit_d;
                  }
                }
                //console.log("--------------");
                //console.log(fruit);
                if (fruit?.nutrients?.VA?.value != undefined) {
                  console.log("------");
                  if (fruit?.nutrients?.VA?.value >= 1.35) {
                    DDS_Array[1] = 1;
                  } else {
                    DDS_Array[2] = 1;
                  }
                } else {
                  DDS_Array[2] = 1;
                }
                console.log(DDS_Array);
                break;
              case "Brote":
              case "Sandwiches":
                DDS_Array[0] = 1;
                console.log(DDS_Array);
                console.log(p.productName);
                this.count_staple.push(p.productName);
                break;
              case "Kartoffeln":
              case "Reis":
              case "Spaghetti":
              case "Nudeln":
                DDS_Array[0] = 1;
                this.count_staple.push(p.productName);
                break;
              case "Milch":
              case "Frischkäse":
              case "Quark":
              case "Joghurt":
              case "Dickmilch":
                DDS_Array[7] = 1;
                break;
              case "käse":
                DDS_Array[7] = 1;
                break;
              case "Vogeleier":
                DDS_Array[8] = 1;
                break;
              case "Fisch":
              case "Fisch und Meeresfrüchte":
                DDS_Array[6] = 1;
                console.log(DDS_Array);
                if (p.quantity != null) {
                  console.log(p.productName);
                  this.meat_consumption.push(parseInt(p.quantity));
                }
                break;
              case "Nüsse":
                DDS_Array[4] = 1;
                break;
              case "Fleish":
                DDS_Array[6] = 1;
                if (p.quantity != null) {
                  this.meat_consumption.push(parseInt(p.quantity));
                }
                break;
              case "Wurst":
                DDS_Array[6] = 1;
                if (p.quantity != null) {
                  this.meat_consumption.push(parseInt(p.quantity));
                }
                this.consume_sausage = true; //as long as users buy it, they will receive negative feedback
                break;
              case "Fette":
                DDS_Array[5] = 1;
                break;
              case "Fertiggerichte":
                this.consume_FastFood = true; //as long as users buy it, they will receive negative feedback
              case "Imbiss":
              case "Süßer Snack":
              case "Salzige Snacks":
                this.consume_snacks = true; //as long as users buy it, they will receive negative feedback
                break;
              case "Erfrischungsgetränke":
                break;
              case "Alkoholische Getränke":
                break;
              default:
                console.log("not found");
            }
          }
        }
      }
    }
    console.log("it is here");
    return DDS_Array;
  }
  async getDDSTag(userID: string) {
    let DDS_Array = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    var is_Vegetarian = false;
    var is_vegan = false;
    const profile = await ProfileSchema.findOne({ userID: userID });
    const tag_String = JSON.stringify(profile?.tags);
    console.log(tag_String.length);
    if (tag_String?.charAt(tag_String?.length - 3) == "u") {
      is_vegan = true;
    } else if (tag_String?.charAt(14) == "t") {
      is_Vegetarian = true;
    }
    if (is_Vegetarian) {
      DDS_Array[5] = 1;
    } else if (is_vegan) {
      DDS_Array[5] = 1;
      DDS_Array[7] = 1;
      DDS_Array[8] = 1;
    }
    console.log(DDS_Array + "----");
    return DDS_Array;
  }
  async getDDS(userID: string): Promise<number[] | null> {
    let products_InList = await this.collectProducts(userID);
    let DDS_Primary = await this.getDDSTag(userID);
    if (products_InList == null) {
      return DDS_Primary;
    }
    console.log(products_InList);
    let DDS = await this.calculateDDS(
      products_InList ?? [""],
      userID,
      DDS_Primary
    );
    return DDS;
  }
}
