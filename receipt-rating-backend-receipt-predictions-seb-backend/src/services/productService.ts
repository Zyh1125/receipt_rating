import axios from 'axios'
import { imageServer, imageServiceURI, openFoodFactsProductUri } from '../config'
import ProductSchema, { ProductInterface } from '../models/product'
import { INutrientLevel, INutriments, IProductIngredient } from '../models/types'


export const resolveProduct = async (productname: string): Promise<ProductInterface[] | null> => {
    const product = await ProductSchema.find({
        receiptNames: {
            $all: [productname]
        }
    })
    return product
}

export const findProductByEan = async (productEan: string, receiptText?: string): Promise<ProductInterface[] | null> => {
    // search own database
    const products = await ProductSchema.find({ ean: productEan })

    if (products.length == 1) {
        // add receipt text to receiptnames in database
        if (receiptText) {
            let nameInProduct = false
            for (const name of products[0].receiptNames) {
                if (name == receiptText) {
                    nameInProduct = true
                    break
                }
            }
            if (!nameInProduct) {
                const product = await ProductSchema.findByIdAndUpdate(products[0].id, {
                    receiptNames: products[0].receiptNames.concat(receiptText)
                })
                if (product) return [product]
            }
        }
    } else {
        // if product is not found in own database, search openFoodFacts
        const result: Response = await axios.get(
            openFoodFactsProductUri + productEan + '.json'
        )
        //@ts-ignore
        const response = result.data

        if (result.status >= 300 || response.status == 0) {
            return null
        }

        // bring in own format
        try {
            const p = formatOpenFoodFactsData(productEan, response.product, receiptText)
            // save in database
            const newEntry = new ProductSchema(p)
            if (!newEntry) return null

            await newEntry.save()
            return [newEntry]
        } catch (error) {
            console.error(error)
            throw new Error("Format Error");
        }
    }
    return products
}

export const findProductByName = async (text: string): Promise<ProductInterface[] | null> => {
    // search own database for product which start with text (case insensitive) 
    const regexBeginn = RegExp("^" + text + "", 'i')
    const productsBeginn = await ProductSchema.find({
        productName: regexBeginn
    })
    let products = productsBeginn.sort((a: ProductInterface, b: ProductInterface) => {
        //@ts-ignore
        if (a.productName.length > b.productName.length) {
            return 1
        }
        return -1
    }).slice(0, 10)

    if (products.length < 10) {
        // search own database for product which includes text (case insensitive) 
        const regexIncludes = RegExp(".*" + text + ".*", 'i')
        let productsIncludes = await ProductSchema.find({
            productName: regexIncludes
        })

        productsIncludes = productsIncludes.slice(0, 10)

        // filter already included products out
        const p = productsIncludes.filter(product =>
            (products.filter(p => p.id == product.id)).length == 0
        )
        // append to array 
        products = products.concat(p)
    }
    // return first 10 elements
    return products.slice(0, 10)
}

export const saveNewProductNamesOffReceipt = async (products: string[]) => {
    try {
        axios.post(imageServer + '/product', {
            products: products
        });
    } catch (error) {
        console.error('Saving products error')
    }
}

export const formatOpenFoodFactsData = (ean: string, openfoodfactsData: any, receiptText?: string) => {
    // ingredients

    let ingredients: IProductIngredient[] = []
    if (openfoodfactsData['ingredients']) {
        for (let i = 0; i < openfoodfactsData['ingredients'].length; i++) {
            const productIngredients = openfoodfactsData['ingredients'][i]
            ingredients.push({ text: productIngredients['text'] })
            if (productIngredients['percent_estimate']) ingredients[i].percent_estimate = productIngredients['percent_estimate']
            if (productIngredients['percent_max']) ingredients[i].percent_max = productIngredients['percent_max']
            if (productIngredients['percent_min']) ingredients[i].percent_min = productIngredients['percent_min']
            if (productIngredients['rank']) ingredients[i].rank = productIngredients['rank']
            if (productIngredients['vegan']) ingredients[i].vegan = productIngredients['vegan']
            if (productIngredients['vegetarian']) ingredients[i].vegetarian = productIngredients['vegetarian']
        }
    }


    // nutriments
    const productNutriments = openfoodfactsData['nutriments']
    let nutriments: INutriments = {
        energy_kcal: productNutriments['energy-kcal'],
        energy_kcal_100g: productNutriments['energy-kcal_100g'],
        energy_kcal_serving: productNutriments['energy-kcal_serving'],
        energy_kcal_unit: productNutriments['energy-kcal_unit']
    }
    if (productNutriments['alcohol']) nutriments.alcohol = productNutriments['alcohol']
    if (productNutriments['alcohol_100g']) nutriments.alcohol_100g = productNutriments['alcohol_100g']
    if (productNutriments['alcohol_serving']) nutriments.alcohol_serving = productNutriments['alcohol_serving']
    if (productNutriments['alcohol_unit']) nutriments.alcohol_unit = productNutriments['alcohol_unit']
    if (productNutriments['carbohydrates']) nutriments.carbohydrates = productNutriments['carbohydrates']
    if (productNutriments['carbohydrates_100g']) nutriments.carbohydrates_100g = productNutriments['carbohydrates_100g']
    if (productNutriments['carbohydrates_serving']) nutriments.carbohydrates_serving = productNutriments['carbohydrates_serving']
    if (productNutriments['carbohydrates_unit']) nutriments.carbohydrates_unit = productNutriments['carbohydrates_unit']
    if (productNutriments['energy']) nutriments.energy = productNutriments['energy']
    if (productNutriments['fat']) nutriments.fat = productNutriments['fat']
    if (productNutriments['fat_100g']) nutriments.fat_100g = productNutriments['fat_100g']
    if (productNutriments['fat_serving']) nutriments.fat_serving = productNutriments['fat_serving']
    if (productNutriments['fat_unit']) nutriments.fat_unit = productNutriments['fat_unit']
    if (productNutriments['fruits-vegetables-nuts-estimate-from-ingredients_100g']) nutriments.fruits_vegetables_nuts_estimate_from_ingredients_100g = productNutriments['fruits-vegetables-nuts-estimate-from-ingredients_100g']
    if (productNutriments['nova_group']) nutriments.nova_group = productNutriments['nova_group']
    if (productNutriments['nova_group_100g']) nutriments.nova_group_100g = productNutriments['nova_group_100g']
    if (productNutriments['nutrition_score_fr']) nutriments.nutrition_score_fr = productNutriments['nutrition_score_fr']
    if (productNutriments['nutrition_score_fr_100g']) nutriments.nutrition_score_fr_100g = productNutriments['nutrition_score_fr_100g']
    if (productNutriments['proteins']) nutriments.proteins = productNutriments['proteins']
    if (productNutriments['proteins_100g']) nutriments.proteins_100g = productNutriments['proteins_100g']
    if (productNutriments['proteins_serving']) nutriments.proteins_serving = productNutriments['proteins_serving']
    if (productNutriments['proteins_unit']) nutriments.proteins_unit = productNutriments['proteins_unit']
    if (productNutriments['salt']) nutriments.salt = productNutriments['salt']
    if (productNutriments['salt_100g']) nutriments.salt_100g = productNutriments['salt_100g']
    if (productNutriments['salt_serving']) nutriments.salt_serving = productNutriments['salt_serving']
    if (productNutriments['salt_unit']) nutriments.salt_unit = productNutriments['salt_unit']
    if (productNutriments['saturated-fat']) nutriments.saturated_fat = productNutriments['saturated-fat']
    if (productNutriments['saturated-fat_100g']) nutriments.saturated_fat_100g = productNutriments['saturated-fat_100g']
    if (productNutriments['saturated-fat_serving']) nutriments.saturated_fat_serving = productNutriments['saturated-fat_serving']
    if (productNutriments['saturated-fat_unit']) nutriments.saturated_fat_unit = productNutriments['saturated-fat_unit']
    if (productNutriments['sodium']) nutriments.sodium = productNutriments['sodium']
    if (productNutriments['sodium_100g']) nutriments.sodium_100g = productNutriments['sodium_100g']
    if (productNutriments['sodium_serving']) nutriments.sodium_serving = productNutriments['sodium_serving']
    if (productNutriments['sodium_unit']) nutriments.sodium_unit = productNutriments['sodium_unit']
    if (productNutriments['sugars']) nutriments.sugars = productNutriments['sugars']
    if (productNutriments['sugars_100g']) nutriments.sugars_100g = productNutriments['sugars_100g']
    if (productNutriments['sugars_serving']) nutriments.sugars_serving = productNutriments['sugars_serving']
    if (productNutriments['sugars_unit']) nutriments.sugars_unit = productNutriments['sugars_unit']
    if (productNutriments['calcium']) nutriments.calcium = productNutriments['calcium']
    if (productNutriments['calcium_100g']) nutriments.calcium_100g = productNutriments['calcium_100g']
    if (productNutriments['calcium_serving']) nutriments.calcium_serving = productNutriments['calcium_serving']
    if (productNutriments['calcium_unit']) nutriments.calcium_unit = productNutriments['calcium_unit']
    if (productNutriments['cholesterol']) nutriments.cholesterol = productNutriments['cholesterol']
    if (productNutriments['cholesterol_100g']) nutriments.cholesterol_100g = productNutriments['cholesterol_100g']
    if (productNutriments['cholesterol_serving']) nutriments.cholesterol_serving = productNutriments['cholesterol_serving']
    if (productNutriments['cholesterol_unit']) nutriments.cholesterol_unit = productNutriments['cholesterol_unit']
    if (productNutriments['fiber']) nutriments.fiber = productNutriments['fiber']
    if (productNutriments['fiber_100g']) nutriments.fiber_100g = productNutriments['fiber_100g']
    if (productNutriments['fiber_serving']) nutriments.fiber_serving = productNutriments['fiber_serving']
    if (productNutriments['fiber_unit']) nutriments.fiber_unit = productNutriments['fiber_unit']
    if (productNutriments['iron']) nutriments.iron = productNutriments['iron']
    if (productNutriments['iron_100g']) nutriments.iron_100g = productNutriments['iron_100g']
    if (productNutriments['iron_serving']) nutriments.iron_serving = productNutriments['iron_serving']
    if (productNutriments['iron_unit']) nutriments.iron_unit = productNutriments['iron_unit']
    if (productNutriments['trans-fat']) nutriments.trans_fat = productNutriments['trans-fat']
    if (productNutriments['trans-fat_100g']) nutriments.trans_fat_100g = productNutriments['trans-fat_100g']
    if (productNutriments['trans-fat_serving']) nutriments.trans_fat_serving = productNutriments['trans-fat_serving']
    if (productNutriments['trans-fat_unit']) nutriments.trans_fat_unit = productNutriments['trans-fat_unit']
    if (productNutriments['vitamin-a']) nutriments.vitamin_a = productNutriments['vitamin-a']
    if (productNutriments['vitamin-a_100g']) nutriments.vitamin_a_100g = productNutriments['vitamin-a_100g']
    if (productNutriments['vitamin-a_serving']) nutriments.vitamin_a_serving = productNutriments['vitamin-a_serving']
    if (productNutriments['vitamin-a_unit']) nutriments.vitamin_a_unit = productNutriments['vitamin-a_unit']
    if (productNutriments['vitamin-c']) nutriments.vitamin_c = productNutriments['vitamin-c']
    if (productNutriments['vitamin-c_100g']) nutriments.vitamin_c_100g = productNutriments['vitamin-c_100g']
    if (productNutriments['vitamin-c_serving']) nutriments.vitamin_c_serving = productNutriments['vitamin-c_serving']
    if (productNutriments['vitamin-c_unit']) nutriments.vitamin_c_unit = productNutriments['vitamin-c_unit']

    let names = [openfoodfactsData['product_name']]
    if (receiptText) names.push(receiptText)

    let nutrientLevels: INutrientLevel = {
        fat: openfoodfactsData['nutrient_levels']['fat'],
        salt: openfoodfactsData['nutrient_levels']['salt'],
        saturated_fat: openfoodfactsData['nutrient_levels']['saturated-fat'],
        sugars: openfoodfactsData['nutrient_levels']['sugars'],
    }
    
    /* image url mapping because image_url is not in openfoodfacts database dump */
    const image_quality = "400"
    var image_url = ""
    try {
        if (openfoodfactsData['image_url']) {
            image_url = openfoodfactsData['image_url'] // if data is read from openfoodfacts api, image_url is given
        } else if (ean.length == 8) {
            if (openfoodfactsData['images']['front_de']) {
                if (openfoodfactsData['images']['front_de']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean+"/front_de."+openfoodfactsData['images']['front_de']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_fr']) {
                if (openfoodfactsData['images']['front_fr']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean+"/front_fr."+openfoodfactsData['images']['front_fr']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_en']) {
                if (openfoodfactsData['images']['front_en']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean+"/front_en."+openfoodfactsData['images']['front_en']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_es']) {
                if (openfoodfactsData['images']['front_es']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean+"/front_es."+openfoodfactsData['images']['front_es']['rev']+"."+image_quality+".jpg"
                }
            }
        } else if (ean.length == 13) {
            if (openfoodfactsData['images']['front_de']) {
                if (openfoodfactsData['images']['front_de']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean.slice(0,3)+"/"+ean.slice(3,6)+"/"+ean.slice(6,9)+"/"+ean.slice(9,13)+"/front_de."+openfoodfactsData['images']['front_de']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_fr']) {
                if (openfoodfactsData['images']['front_fr']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean.slice(0,3)+"/"+ean.slice(3,6)+"/"+ean.slice(6,9)+"/"+ean.slice(9,13)+"/front_fr."+openfoodfactsData['images']['front_fr']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_en']) {
                if (openfoodfactsData['images']['front_en']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean.slice(0,3)+"/"+ean.slice(3,6)+"/"+ean.slice(6,9)+"/"+ean.slice(9,13)+"/front_en."+openfoodfactsData['images']['front_en']['rev']+"."+image_quality+".jpg"
                }
            } else if (openfoodfactsData['images']['front_es']) {
                if (openfoodfactsData['images']['front_es']['rev']) {
                    image_url = "https://world.openfoodfacts.org/images/products/"+ean.slice(0,3)+"/"+ean.slice(3,6)+"/"+ean.slice(6,9)+"/"+ean.slice(9,13)+"/front_es."+openfoodfactsData['images']['front_es']['rev']+"."+image_quality+".jpg"
                }
            }
        }
    } catch (e) {
        console.log("image parser error")
    }
    const product = {
        ean: ean,
        brands: openfoodfactsData['brands'],
        categories: openfoodfactsData['categories'] ? openfoodfactsData['categories'].split(',') : [],
        ecoscoreGrade: openfoodfactsData['ecoscore_grade'] == 'unknown' ? null : openfoodfactsData['ecoscore_grade'],
        imageUrl: image_url,
        ingredients: ingredients,
        ingredientsText: openfoodfactsData['ingredients_text'],
        ingredientsTextDE: openfoodfactsData['ingredients_text_de'] ?? openfoodfactsData['ingredients_text'],
        labels: openfoodfactsData['labels'],
        novaGroup: openfoodfactsData['nova_group'],
        nutriments: nutriments,
        nutrientLevels: nutrientLevels,
        nutriScore: openfoodfactsData['nutriscore_grade'],
        //nutriScoreData: TODO
        nutriScoreScore: openfoodfactsData['nutriscore_score'],
        productName: openfoodfactsData['product_name'],
        productNameDE: openfoodfactsData['product_name_de'] ?? openfoodfactsData['product_name'],
        quantity: openfoodfactsData['quantity'],
        receiptNames: names,
    }
    return product
}