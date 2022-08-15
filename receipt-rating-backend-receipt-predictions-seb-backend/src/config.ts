import { AzureKeyCredential, FormRecognizerClient } from "@azure/ai-form-recognizer";
import { ErrorMessage } from "./models/types";

import { MongoClient } from "mongodb";
import { Db } from "mongodb";

//Configuration variables
export const mongoURI = 'mongodb://localhost:27017/receipt_rating'  //'mongodb://nodeApp:tum%40OKijUH@localhost:5000/NutritionalData?authSource=admin';  //'mongodb://localhost:27017/receipt_rating' // //  //'mongodb://localhost:27017/receipt_rating'  // tum@OKijUH
// export const mongoURI_OFF = 'mongodb://localhost:27017/openfoodfacts'
export const mongoURI_OFF = 'mongodb://localhost:27017/openfoodfacts'//'mongodb://nodeApp:tum%40OKijUH@localhost:5000/openfoodfacts?authSource=admin'
export const JwtSecret = 'very secret secret';
//export const imageServiceURI = 'http://192.168.178.20:5000/api/receipt'
export const imageServer = 'http://localhost:5000/api'
export const imageServiceURI = imageServer + '/receipt'
export const openFoodFactsProductUri = 'https://world.openfoodfacts.org/api/v0/product/'
//azure service
const apiKey = "b96b4546368a453fba25374750d29955";
const endpoint = "https://tum-receiptscan.cognitiveservices.azure.com/";
export const formRecognizerClient = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));

export const internalServerErrorMessage = {
    error: 'Internal server error',
    message: 'Internal server error'
}

export const badRequestErrorMessage = (msg: string): ErrorMessage => {
    return {
        error: 'Bad Request',
        message: msg
    }
}

export let openfoodfactsDB:Db;
MongoClient.connect(mongoURI_OFF, {
    //@ts-ignore
    useNewUrlParser: true, 
    useUnifiedTopology: true,
}).then(
    client => {openfoodfactsDB = client.db('openfoodfacts')}
);