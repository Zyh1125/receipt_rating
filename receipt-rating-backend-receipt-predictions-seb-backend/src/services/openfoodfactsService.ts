import * as Constants from '../config'

export const findProductByCode = async (code: string): Promise<any | null> => {
    const product = await Constants.openfoodfactsDB.collection('off').findOne({ 
        "code": code,
    })
    return product
}

export const findBetterNutriScore = async (input_product: any, profile_tags: any, ignore_categories:any): Promise<any | null> => {
    // dynamic query:
    // https://stackoverflow.com/questions/29466377/programmatically-build-dynamic-query-with-mongoose

    const amt_alternatives = 5
    const score_sensitivity = 3

    /* Build query */
    let query:any = {}
    let category = ""
    try {
        const profile_query = generateProfileQuery(profile_tags)
        const category_query = generateCategoryQuery(input_product, ignore_categories)?.query
        category = generateCategoryQuery(input_product, ignore_categories)?.category
        query = { ...query, ...profile_query, ...category_query}
    } catch {
        return
    }

    /* Add nutri-score filter to query and query database */
    if (input_product?.nutriscore_score) {
        query["nutriscore_score_opposite"] = { $gt: -(input_product.nutriscore_score-score_sensitivity) }

        /* Retrieve alternatives and sort by Nutri-Score */
        try {
            const altSelection = await Constants.openfoodfactsDB.collection('off').find(query)
            .maxTimeMS(10000)
            .sort( { nutriscore_score: 1 } ) // sort in ascending order
            .limit(30).toArray() // get 30 best options -> later randomly return n of them
            //.limit(amt_alternatives).toArray() // return best n alternatives

            /* Randomize returned alternatives: select n items from the best 30 returned from the query */
            const shuffled = altSelection.sort(() => 0.5 - Math.random());
            let result = shuffled.slice(0, amt_alternatives);

            return {"category": category, "alternatives": result}
        } catch {
            console.log(input_product.code+" - query timeout")
            return
        }
    } else {
        return
    }
}

export const findBetterNovaGroup = async (input_product: any, profile_tags: any, ignore_categories:any): Promise<any | null> => {
    const amt_alternatives = 5

    /* Build query */
    let query:any = {}
    let category:string = ""
    try {
        const category_query = generateCategoryQuery(input_product, ignore_categories)?.query
        const profile_query = generateProfileQuery(profile_tags)
        category = generateCategoryQuery(input_product, ignore_categories)?.category
        query = { ...query, ...profile_query, ...category_query}
    } catch {
        return
    }

    /* check if alternative product is at least as healthy as the input product based on nutri-score score (only if it has a nutri-score) */
    if (input_product?.nutriscore_score) {
        query["nutriscore_score_opposite"] = { $gte: -(input_product.nutriscore_score) }
    }

    /* Add nova filter to query and query database */
    if (input_product?.nova_group) {
        query["nova_group"] = { $lt: input_product.nova_group }
        
        try {
            const altSelection = await Constants.openfoodfactsDB.collection('off').find(query)
            .maxTimeMS(10000)
            .sort( { nova_groups_tags: 1 } ) // sort in ascending order
            .limit(30).toArray() // get 30 best options -> later randomly return n of them
            //.limit(amt_alternatives).toArray() // return best n alternatives

            /* Randomize returned alternatives: select n items from the best 30 returned from the query */
            const shuffled = altSelection.sort(() => 0.5 - Math.random());
            let result = shuffled.slice(0, amt_alternatives);

            return {"category": category, "alternatives": result} //alternatives 
        } catch {
            console.log(input_product.code+" - query timeout")
            return
        }
    } else {
        return
    }
}

/* Generates a profile filter for the respective input product */
export const generateProfileQuery = (profile_tags:any) => {
    let query:any = {}
    /* Consider user settings */
    if (profile_tags.vegan) {
        query["ingredients_analysis_tags"] = { $in: ["en:vegan"]} // if vegan -> only show vegan alternatives
    } else if (profile_tags.vegetarian) {
        query["ingredients_analysis_tags"] = { $in: ["en:vegan", "en:vegetarian"]} // if vegetarian -> show vegan and vegetarian alternatives
    }
    return query
}

/* Generates a category filter for the respective input product */
export const generateCategoryQuery = (input_product:any, ignore_categories:any) => {
    let query:any = {}
    let category = ""
    /* Add product filters to query */
    if (input_product && input_product?.categories_hierarchy) {

        /* if (input_product.stores_tags.length > 0) {
            query["stores_tags"] = { $or: [{$in: input_product.stores_tags},{$eq: []}] }
        } */

        /* usually highest category in hierarchy */
        category = input_product.categories_hierarchy[input_product.categories_hierarchy.length - 1]

        // CORRECT FREQUENT CATEGORY ERRORS
        /* use second category in case of too large or generic categories */
        if (category == "en:starters") {
            category = input_product.categories_hierarchy[input_product.categories_hierarchy.length - 2] ? input_product.categories_hierarchy[input_product.categories_hierarchy.length - 2] : input_product.categories_hierarchy[input_product.categories_hierarchy.length - 1]
        }
        /* exclude if generic category and no second category given */
        if (category == "en:frozen-foods" || ignore_categories.includes(category)) {
            throw "Too many entries in category "+category
        }

        query["categories_tags"] = { $in: [category] }
        query = { ...query, $or: [{"countries": "Germany"}, {"countries": "Deutschland"}, {"countries_tags": {$in: ["en:deutschland", "en:germany"]}}]}
    }
    return {query, category}
}