import { Request, Response } from 'express';
import { badRequestErrorMessage, internalServerErrorMessage } from '../config';
import ProductSchema from '../models/product';
import ReceiptSchema, { ReceiptInterface } from '../models/receipt';
import { IReceipt, IReceiptDBEntry, IReceiptInformation, IStatistics, ProductInformation, ReceiptProductDBEntry, ReceiptProductInformation, ReceiptProductInformationIndexed } from '../models/types';
import UserSchema from '../models/user';
import { recognizeReceipt } from '../services/imageService';
import { resolveProduct } from '../services/productService';

export async function resolveReceipt(req: Request, res: Response) {
    const { id } = req.params;
    try {
        //@ts-ignore
        if (!req.files.image) {
            return res.status(400).json(badRequestErrorMessage('No image provided'));
        }
        //@ts-ignore
        const file = req.files.image

        // send image to Image Service and resolve Products
        const receipt: IReceiptInformation = await recognizeReceipt(file.path)

        //resolve recognized products
        const products: ReceiptProductInformation[] = []

        for (const product of receipt.items) {
            const p = await resolveProduct(product.name)
            let ignored = false
            if (product.name.includes('Pfand') || product.name.includes('Leergut') || product.name.includes('Zahncreme') || product.name.includes('Klopap') || product.name.includes('Toilette')) {
                ignored = true
            }
            products.push({
                name: product.name,
                amount: product.amount,
                unit: product.unit,
                price: product.price,
                ignored: ignored,
                product: p ? p : null
            })
        }
        //resolve unknown products
        const products_unknown: ReceiptProductInformation[] = []
        for (const product of receipt.unknownItems) {
            const p = await resolveProduct(product.name)
            products_unknown.push({
                name: product.name,
                amount: product.amount,
                unit: product.unit,
                price: product.price,
                product: p ? p : null
            })
        }
        const response = {
            store: receipt.store,
            date: new Date(),
            detectedProducts: products,
            unknownProducts: products_unknown,
            totalPrice: receipt.totalPrice
        }

        return res.status(200).send(response)

    } catch (error) {
        console.log(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function saveReceipt(req: Request, res: Response) {
    const { receipt, statistics } = req.body;
    try {
        //@ts-ignore
        const userID = req.userId

        if (!receipt) { return res.status(400).json(badRequestErrorMessage('Receipt information missing from body')) }

        let newReceipt: IReceiptDBEntry = await parseReceiptInformation(receipt, userID)

        const estimation_result:any = calculateCaloriesOnReceipt(receipt)

        const calories = estimation_result.receiptCalories
        const salt = estimation_result.receipt_salt
        const sugar = estimation_result.receipt_sugar
        const saturated_fat = estimation_result.receipt_sfats
        const fat = estimation_result.receipt_fats
        const used_products_counter_CAL = estimation_result.used_products_counter_CAL
        const used_products_counter_SSFS = estimation_result.used_products_counter_SSFS

        let r = new ReceiptSchema(newReceipt)
        if (r) await r.save()

        //save tracking statistics
        try {
            let user = await UserSchema.findById(userID)
            if (user) {
                const stats: IStatistics = {
                    ...statistics,
                    receiptID: r.id,
                    calories: calories,
                    used_products_counter_CAL: used_products_counter_CAL,
                    salt: salt,
                    sugar: sugar,
                    saturated_fat: saturated_fat,
                    fat: fat,
                    used_products_counter_SSFS: used_products_counter_SSFS,
                    numberlinkedProducts: r.products.filter(p => p.product != '').length,
                    numberOfProducts: r.products.filter(p => p.ignored != true).length
                }
                user.receiptStats = user.receiptStats ? user.receiptStats.concat(stats) : [stats]

                await UserSchema.findByIdAndUpdate(userID, user)
            }
        } catch (error) {
            console.log(error)
        }

        const receiptResponse: IReceipt = await resolveProductsOnReceipts(r)

        return res.status(200).send({
            message: 'Saved Receipt',
            receipt: receiptResponse
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function updateReceipt(req: Request, res: Response) {
    const { receipt, statistics } = req.body;
    try {
        //@ts-ignore
        const userID = req.userId

        if (!receipt) { return res.status(400).json(badRequestErrorMessage('Receipt information missing from body')) }

        let updatedReceipt: IReceiptDBEntry = await parseReceiptInformation(receipt, userID)

        const estimation_result:any = calculateCaloriesOnReceipt(receipt)

        const calories = estimation_result.receiptCalories
        const salt = estimation_result.receipt_salt
        const sugar = estimation_result.receipt_sugar
        const saturated_fat = estimation_result.receipt_sfats
        const fat = estimation_result.receipt_fats
        const used_products_counter_CAL = estimation_result.used_products_counter_CAL
        const used_products_counter_SSFS = estimation_result.used_products_counter_SSFS

        const r = await ReceiptSchema.findByIdAndUpdate(receipt.id, updatedReceipt, { returnOriginal: false })

        //update tracking statistics
        if (r) {
            try {
                let user = await UserSchema.findById(userID)
                if (user) {
                    const rStats = user.receiptStats?.filter(s => s.receiptID == r.id)[0]
                    if (rStats) {
                        const stats: IStatistics = {
                            receiptID: rStats.receiptID,
                            processTime: rStats.processTime + statistics.processTime,
                            calories: calories,
                            used_products_counter_CAL: used_products_counter_CAL,
                            salt: salt,
                            sugar: sugar,
                            saturated_fat: saturated_fat,
                            fat: fat,
                            used_products_counter_SSFS: used_products_counter_SSFS,
                            addedToReceipt: rStats.addedToReceipt.concat(statistics.addedToReceipt),
                            manuallyLinkedProducts: rStats.manuallyLinkedProducts + statistics.manuallyLinkedProducts,
                            numberlinkedProducts: r.products.filter(p => p.product != '').length,
                            numberOfProducts: r.products.filter(p => p.ignored != true).length
                        }
                        user.receiptStats = user.receiptStats
                            ? user.receiptStats.filter(s => s.receiptID != r.id).concat(stats)
                            : [stats]

                        await UserSchema.findByIdAndUpdate(userID, user)
                    }
                }
            } catch (error) {
                console.log(error)
            }
        } else {
            return res.status(404).send({
                error: 'Not Found',
                message: 'Receipt not found'
            })
        }

        const receiptResponse: IReceipt = await resolveProductsOnReceipts(r)

        return res.status(200).send({
            message: 'Saved Receipt',
            receipt: receiptResponse
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function deleteReceipt(req: Request, res: Response) {
    const { id } = req.params;

    try {
        //@ts-ignore
        const userID = req.userId

        if (!id) { return res.status(400).json(badRequestErrorMessage('Receipt id missing in request to delete a receipt')) }

        const receipt = await ReceiptSchema.findById(id)

        if (!receipt || receipt.userID != userID) {
            return res.status(403).json({ error: 'Forbidden', message: `You have no permission to delete the receipt with id: ${id}` })
        }

        await ReceiptSchema.findByIdAndDelete(receipt.id)

        return res.status(200).send({
            message: `Deleted Successfull receipt with id ${id}`,
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

export async function getReceipts(req: Request, res: Response) {
    try {
        //@ts-ignore
        const userID = req.userId
        let receipts = []

        //check if admin then return all receipts - to evaluate the Userstudy
        const user = await UserSchema.findById(userID)
        if (user?.username == 'esteradmin') {
            receipts = await ReceiptSchema.find()
        } else {
            receipts = await ReceiptSchema.find({
                userID: userID
            })
        }

        const response: IReceipt[] = await Promise.all(receipts.map(async (receipt) => {
            return resolveProductsOnReceipts(receipt)
        }))

        return res.status(200).send({
            receipts: response,
            message: 'Retrieved Receipts'
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json(internalServerErrorMessage);
    }
}

/**
 * go through products in receipt db entry and look for a string, which represents the id in the products db
 * for every id look in db and replace the string with it or null
 * @param r receipt db entry
 * @returns receipt with resolved products
 */
const resolveProductsOnReceipts = async (r: ReceiptInterface) => {

    let products: ReceiptProductInformationIndexed[] = []
    await Promise.all(r.products.map(async (product: ReceiptProductDBEntry, index: number) => {
        //resolve Product
        let p: ProductInformation | null = null
        if (product.product) {
            //@ts-ignore
            p = await ProductSchema.findById(product.product)
        }
        products.push({
            name: product.name,
            amount: product.amount,
            unit: product.unit,
            ignored: product.ignored ?? false,
            product: p ? [p] : null,
            //set index to reorder products as on receipt
            index: index
        })
        // check if name on receipt is saved in product
        if (p) {
            if (p.receiptNames.filter(n => n == product.name).length == 0) {
                //not save in product -> update product
                try {
                    p.receiptNames.push(product.name)
                    await ProductSchema.findByIdAndUpdate(p.id, p)
                } catch (error) {
                    console.log(error)
                }
            }
        }
    }))

    //reorder products as on receipt
    const ps: ReceiptProductInformation[] = products.sort((a: ReceiptProductInformationIndexed, b: ReceiptProductInformationIndexed) => {
        if (a.index < b.index) return -1;
        if (a.index > b.index) return 1;
        return 0;
    }).map((product: ReceiptProductInformationIndexed) => {
        //@ts-ignore
        delete product.index
        return product
    })

    const receipt: IReceipt = {
        title: r.title,
        date: r.date,
        store: r.store ?? '',
        products: ps,
        score: r.score,
        id: r.id,
    }
    return receipt
}

/**
 * calculate average nutriscore of all products on receipt
 * @param receipt 
 * @returns nutriscore score
 */
const calculateReceiptNutriAverage = (receipt: IReceipt): string => {
    // add score to score array for every amount bought
    const addScores = (array: { score: number }[], product: ReceiptProductInformation, score: number) => {
        // piece -> amount
        if (product.unit == 'piece') {
            for (let i = 0; i < product.amount; i++) {
                array = array.concat({ score: score })
            }
        } else {
            // gramm -> per poriton size or default per 200g
            const portionSize = product.product && product.product[0].quantity
                ? parseInt(product.product[0].quantity.replace(/[^0-9,\.\,]/g, ''), 10)
                : 200
            for (let i = 0; i < product.amount; i += portionSize) {
                // only count when more than half of the portion size is left
                if (product.amount - i >= portionSize / 2) {
                    array = array.concat({ score: score })
                }
            }
        }
        return array
    }
    // get score of each product 
    let scores: { score: number }[] = []
    receipt.products.forEach(product => {
        if (product.product && product.product.length == 1) {
            if (product.product[0].nutriScore?.toUpperCase() == 'A') { scores = addScores(scores, product, 1) }
            else if (product.product[0].nutriScore?.toUpperCase() == 'B') { scores = addScores(scores, product, 2) }
            else if (product.product[0].nutriScore?.toUpperCase() == 'C') { scores = addScores(scores, product, 3) }
            else if (product.product[0].nutriScore?.toUpperCase() == 'D') { scores = addScores(scores, product, 4) }
            else if (product.product[0].nutriScore?.toUpperCase() == 'E') { scores = addScores(scores, product, 5) }
        }
    })
    // sum up scores
    let receiptScore = 0
    for (const score of scores) {
        receiptScore += score.score
    }
    // determine the average nutriscore
    let nutriScore = '-'
    if (receiptScore / scores.length <= 1.5) { nutriScore = 'A' }
    else if (receiptScore / scores.length <= 2.5) { nutriScore = 'B' }
    else if (receiptScore / scores.length <= 3.5) { nutriScore = 'C' }
    else if (receiptScore / scores.length <= 4.5) { nutriScore = 'D' }
    else if (receiptScore / scores.length <= 5) { nutriScore = 'E' }
    return nutriScore
}

/**
 * calculate the calories of all linked products on receipt and sum them up
 * @param receipt 
 * @returns sumed up calories number of all products on receipt
 */
const calculateCaloriesOnReceipt = (receipt: IReceipt, debug?: boolean): any => {
    let used_products_counter_CAL = 0 // how many products are considered for calorie estimation
    let used_products_counter_SSFS = 0 // how many products are considered for estimation of salt, sugar, fat, saturated fat

    let receiptCalories: number = 0
    let receipt_salt: number = 0
    let receipt_sfats: number = 0
    let receipt_fats: number = 0
    let receipt_sugar: number = 0
    // go through every product
    receipt.products.forEach(product => {
        let productCalories = 0
        let product_salt: number = 0
        let product_sfats: number = 0
        let product_fats: number = 0
        let product_sugar: number = 0
        // if a product is linked
        if (product.product && product.product.length == 1) {
            const p = product.product[0]
            console.log(product.name)
            // unit is gramm
            if (product.unit == 'g') {
                if (p.nutriments.energy_kcal_100g) {
                    //calculate (quantity given in g * energy per 100g / 100) = calories of product
                    const pCalories = p.nutriments.energy_kcal_100g * (product.amount / 100)
                    productCalories = pCalories
                }
                if (p.nutriments.salt_100g) {
                    product_salt = p.nutriments.salt_100g * (product.amount / 100)
                }
                if (p.nutriments.fat_100g && p.nutriments.fat_unit == "g") {
                    product_fats = p.nutriments.fat_100g * (product.amount / 100)
                }
                if (p.nutriments.saturated_fat_100g && p.nutriments.saturated_fat_unit == "g") {
                    product_sfats = p.nutriments.saturated_fat_100g * (product.amount / 100)
                }
                if (p.nutriments.sugars_100g && p.nutriments.sugars_unit == "g") {
                    product_sugar = p.nutriments.sugars_100g * (product.amount / 100)
                }

                // unit is piece
            } else if (product.unit == 'piece') {
                // no kcal/serving field OR whole product is consumable in less than a week
                if (!p.nutriments.energy_kcal_serving || p.nutriments.energy_kcal_serving && p.nutriments.energy_kcal && (p.nutriments.energy_kcal / p.nutriments.energy_kcal_serving) < 8) {
                    // quantity given
                    if (p.quantity && p.nutriments.energy_kcal_100g) {
                        // if quantity is given
                        const quantity = parseInt(p.quantity.replace(/[^0-9,\.\,]/g, ''), 10)
                        const quantityUnit = p.quantity.replace(/[0-9,\.\,]/g, '').replace(' ', '')

                        if (quantityUnit == 'g' || quantityUnit == 'ml') {
                            const pCalories = p.nutriments.energy_kcal_100g * (product.amount * quantity / 100)
                            productCalories = pCalories ?? 0
                        } else if (quantityUnit == 'kg' || quantityUnit == 'l') {
                            const pCalories = p.nutriments.energy_kcal_100g * (product.amount * quantity * 10)
                            productCalories = pCalories ?? 0
                        } else {
                            productCalories = p.nutriments.energy_kcal ?? p.nutriments.energy_kcal_100g
                        }
                        used_products_counter_CAL = used_products_counter_CAL+1
                    } else if (p.nutriments.energy_kcal) {
                        // if quantity is not given, calculate with overall kcal if given
                        productCalories = p.nutriments.energy_kcal * product.amount
                        used_products_counter_CAL = used_products_counter_CAL+1
                    } else if (p.nutriments.energy_kcal_100g) {
                        // energy_kcal is undefined, assume 100g per piece
                        productCalories = p.nutriments.energy_kcal_100g * (product.amount / 100)
                        used_products_counter_CAL = used_products_counter_CAL+1
                    } else {
                        console.log(' ! Not counted Calories: ' + product.name)
                    }
                } else {
                    // long time product one serving per day (7 days) 
                    const pCalories = p.nutriments.energy_kcal_serving * 7
                    productCalories = pCalories
                    used_products_counter_CAL = used_products_counter_CAL+1
                    console.log(" ! Longterm product (only consider 7 servings per week): "+product.name)
                }
                console.log(" - CALORIES: "+productCalories+"kcal")

                // count sugar, salt, saturated fats, fats
                if (p.nutriments.salt_100g && p.nutriments.sugars_100g && p.nutriments.saturated_fat_100g && p.nutriments.fat_100g) {
                    let quantity:number = 100 // default if quantity unknown
                    let quantityUnit:String = 'g' // default if quantityUnit unknown
                    if (p.quantity && p.quantity != "") {
                        quantity = parseInt(p.quantity.replace(/[^0-9,\.\,]/g, ''), 10)
                        quantityUnit = p.quantity.replace(/[0-9,\.\,]/g, '').replace(' ', '')
                    } else {
                        console.log(" ! Quantity not found: Defaulting to 100g")
                    }
                    let factor = 0
                    if (quantityUnit == 'g' || quantityUnit == 'ml') {
                        factor = 100
                    } else if (quantityUnit == 'kg' || quantityUnit == 'l') {
                        factor = 10
                    } else {
                        console.log(" ! QuantityUnit not found: Not counted salt, sugar, fat, saturated fat: " + product.name)
                    }

                    // estimate values per product for 7 days

                    // filter out pure salt packages
                    if (p.nutriments.salt_100g < 99) {
                        product_salt = p.nutriments.salt_100g * (product.amount * quantity / factor)
                    } else {
                        product_salt = 2 * 7 * 0.2 // usually 0.2g per serving, twice per day, 7 days a week
                    }
                    // filter out pure sugar packages
                    if (p.nutriments.sugars_100g < 99) {
                        product_sugar = p.nutriments.sugars_100g * (product.amount * quantity / factor)
                    } else {
                        product_sugar = 2 * 7 * 0.2 // usually 0.2g per serving, twice per day, 7 days a week
                    }
                    product_sfats = p.nutriments.saturated_fat_100g * (product.amount * quantity / factor)
                    product_fats = p.nutriments.fat_100g * (product.amount * quantity / factor)
                    
                    used_products_counter_SSFS = used_products_counter_SSFS+1

                    console.log(" - SALT: "+product_salt+" ("+p.nutriments.salt_100g+" per 100g)"+ "; quantity: "+product.amount+" x "+quantity+quantityUnit)
                    console.log(" - SUGAR: "+product_sugar+" ("+p.nutriments.sugars_100g+" per 100g)"+ "; quantity: "+product.amount+" x "+quantity+quantityUnit)
                    console.log(" - SFAT: "+product_sfats+" ("+p.nutriments.saturated_fat_100g+" per 100g)"+ "; quantity: "+product.amount+" x "+quantity+quantityUnit)
                    console.log(" - FAT: "+product_fats+" ("+p.nutriments.fat_100g+" per 100g)"+ "; quantity: "+product.amount+" x "+quantity+quantityUnit)
                } else {
                    console.log(" ! Values not found: Salt, sugar, fat, saturated fat or quantity: " + product.name)
                }
            } else {
                console.log(' ! Not considered in nutrition evaluation: ' + product.name)
            }
        }
        debug && product.product && console.log(product.product[0].productName, productCalories)
        receiptCalories += productCalories
        receipt_salt += product_salt
        receipt_sfats += product_sfats
        receipt_fats += product_fats
        receipt_sugar += product_sugar
    })
    console.log("\nTotal:")
    console.log("CALORIES: "+receiptCalories)
    console.log("SALT: "+receipt_salt)
    console.log("SUGAR: "+receipt_sugar)
    console.log("SFAT: "+receipt_sfats)
    console.log("FAT: "+receipt_fats)

    console.log("Considered products for calorie estimation: "+used_products_counter_CAL)
    console.log("Considered products for salt/sugar/sfat/fat estimation: "+used_products_counter_SSFS)
    debug && console.log(receiptCalories)
    return {receiptCalories, used_products_counter_CAL, receipt_salt, receipt_sugar, receipt_sfats, receipt_fats, used_products_counter_SSFS}
}

/**
 * parse the information of an incoming receipt for db 
 * @param receipt incoming receipt
 * @param userID id of user
 * @returns IReceiptDBEntry
 */
const parseReceiptInformation = async (receipt: IReceipt, userID: string): Promise<IReceiptDBEntry> => {
    let newReceipt: IReceiptDBEntry = {
        title: receipt.title ?? dateToString(receipt.date ?? new Date()),
        date: receipt.date ?? new Date(),
        store: receipt.store ?? '',
        products: [],
        score: 'A',
        userID: userID
    }

    // parse incoming information
    for (const p of receipt.products) {
        if (p.ignored) {
            newReceipt.products.push({
                name: p.name,
                product: '',
                ignored: true,
                amount: !isNaN(Number(p.amount)) ? Number(p.amount) : 1,
                unit: p.unit
            })
        } else {
            let product = p.product ? p.product[0] : undefined
            if (product) {
                if (product.id) {
                    //product exists in db
                    await ProductSchema.findByIdAndUpdate(product.id, product)
                } else {
                    //does not exist in db
                    product = await new ProductSchema(product).save()

                }
                newReceipt.products.push({
                    name: p.name,
                    product: product.id,
                    amount: !isNaN(Number(p.amount)) ? Number(p.amount) : 1,
                    unit: p.unit
                })

            } else {
                newReceipt.products.push({
                    name: p.name,
                    product: '',
                    amount: !isNaN(Number(p.amount)) ? Number(p.amount) : 1,
                    unit: p.unit
                })
            }
        }
    }
    // calculate average
    newReceipt.score = calculateReceiptNutriAverage(receipt)
    return newReceipt
}

/**
 * converts a date (string) into used date representation as string
 * @param date: string or date which should formated
 * @returns formated date string
 */
const dateToString = (date: string | Date): string => {
    const d = new Date(date)
    if (!isNaN(d.getTime())) {
        return '' + d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear()
    } else {
        return 'Error: Invalid date'
    }
}