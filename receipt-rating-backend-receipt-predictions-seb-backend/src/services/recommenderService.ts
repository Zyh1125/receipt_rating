import { IFeedItem } from "../models/types";
import {
  findBetterNovaGroup,
  findBetterNutriScore,
  findProductByCode,
} from "./openfoodfactsService";
import { formatOpenFoodFactsData } from "./productService";

/* Recommender service for generating alternatives with better Nutri-Score */
export const createAltNutriScore = async (
  product_list: any,
  profile_tags: any,
  ignore_categories: any
) => {
  // TODO: exclude products that already are Nutri-Score A or B

  // filter out products without nutriscore and sort product list by Nutri-Score score
  const sorted_by_nutriscorescore = product_list
    .filter((el: any) => {
      return el.nutriScoreScore != undefined;
    })
    .sort((a: any, b: any) => {
      return b.nutriScoreScore - a.nutriScoreScore;
    });

  // filter out duplicates -------------------- TODO -------------------- MOVE TO feedService
  const uniqueIds: any = [];
  const unique = sorted_by_nutriscorescore.filter((element: any) => {
    const isDuplicate = uniqueIds.includes(element.id);
    if (!isDuplicate) {
      uniqueIds.push(element.id);
      return true;
    }
  });

  // select a maximum number of products to generate recommendations for
  const selection = unique.slice(0, 20);

  // go through each product, generate lists of alternatives and feed items
  let promises: any = [];
  selection.forEach(async (item: any) => {
    promises.push(
      getAlternatives(
        item.ean,
        findBetterNutriScore,
        profile_tags,
        ignore_categories,
        "Alt_NutriScore"
      )
    );
  });
  let result = await Promise.all(promises);

  result = result.filter((item) => item != undefined);

  console.log("-- recommender service [nutri score alternative] finished");

  // return list of all generated feed items
  return result;
};

/* Recommender service for generating alternatives with better NOVA group */
export const createAltNovaGroup = async (
  product_list: any,
  profile_tags: any,
  ignore_categories: any
): Promise<IFeedItem[][]> => {
  // filter out products without NOVA group and sort product list by NOVA group
  const sorted_by_nova = product_list
    .filter((el: any) => {
      return el.novaGroup != undefined;
    })
    .sort((a: any, b: any) => {
      return b.novaGroup - a.novaGroup;
    });

  // filter out duplicates -------------------- TODO -------------------- MOVE TO feedService
  const uniqueIds: any = [];
  const unique = sorted_by_nova.filter((element: any) => {
    const isDuplicate = uniqueIds.includes(element.id);
    if (!isDuplicate) {
      uniqueIds.push(element.id);
      return true;
    }
  });

  // select a maximum number of products to generate recommendations for
  const selection = unique.slice(0, 20);
  // go through each product, generate lists of alternatives and feed items
  let promises: any = [];
  selection.forEach(async (item: any) => {
    promises.push(
      getAlternatives(
        item.ean,
        findBetterNovaGroup,
        profile_tags,
        ignore_categories,
        "Alt_NovaGroup"
      )
    );
  });
  let result = await Promise.all(promises);
  result = result.filter((item) => item != undefined);

  console.log("-- recommender service [NOVA group alternative] finished");

  // return list of all generated feed items
  return result;
};

/* This function retrieves a list of alternative product feed items depending on the input query function */
const getAlternatives = async (
  ean: string,
  query: Function,
  profile_tags: any,
  ignore_categories: any,
  feedItemType: string
): Promise<IFeedItem[]> => {
  let startDate = new Date();
  const product = await findProductByCode(ean); // unformatted openfoodfacts json
  const query_results = await query(product, profile_tags, ignore_categories); // unformatted openfoodfacts json
  const alt_product = query_results?.alternatives
    ? query_results.alternatives
    : undefined;
  const category = query_results?.category ? query_results.category : undefined;
  let endDate = new Date();

  let alt_list: any = [];
  if (product && alt_product?.length > 0) {
    console.log(
      product.code +
        " - alternative found: " +
        (alt_product[0].code + " (+" + (alt_product.length - 1) + " others)") +
        " in " +
        (endDate.getTime() - startDate.getTime()) / 1000 +
        "s"
    );

    // parse products to internal product representation
    const internal_product = formatOpenFoodFactsData(product.code, product);

    alt_product.forEach((alt: any) => {
      const internal_alt_product = formatOpenFoodFactsData(alt.code, alt);

      // calculate priority of feed items for ordering by importance (the better the improvement of the alternative, the more important)
      let prio = calculatePrio(
        feedItemType,
        internal_product,
        internal_alt_product
      );

      alt_list.push({
        uid: hashCode(
          feedItemType + internal_product.ean + internal_alt_product.ean
        ),
        date: new Date(),
        itemtype: feedItemType,
        prio: prio,
        category: category,
        parameters: {
          product: internal_product,
          alt_product: internal_alt_product,
        },
      });
    });
  } else if (product && alt_product?.length == 0) {
    console.log(product.code + " - no alternative found");
  } else {
    console.log(ean + " - product not found in local database");
  }
  return alt_list;
};

const hashCode = function (input: string) {
  var hash = 0;
  if (input.length == 0) return hash;
  for (let i = 0; i < input.length; i++) {
    let char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

const calculatePrio = (feedItemType: string, prod: any, alt_prod: any) => {
  if (feedItemType == "Alt_NutriScore") {
    const diff = prod.nutriScoreScore - alt_prod.nutriScoreScore;
    return diff > 30 ? 1 : diff / 30; // 30 could be a good approximation for the best nutriscore-score improvement possible
  } else if (feedItemType == "Alt_NovaGroup") {
    const diff = prod.novaGroup - alt_prod.novaGroup;
    return diff > 4 ? 1 : diff / 6; // by 6 because low nova-group improvements do not imply significant health improvement and often result in worse products -> highest possible prio-score for nova groups is 0.5
  } else {
    return 0;
  }
};
