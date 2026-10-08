/**
 * Diet & allergy checks based on ingredient names.
 *
 * These are best-effort keyword rules — always double-check labels if an allergy is serious.
 */

const MEAT =
  /\b(beef|steak|mince|minced meat|ground meat|pork|bacon|ham|prosciutto|pancetta|chorizo|salami|pepperoni|sausages?|lamb|mutton|goat|veal|chicken|turkey|duck|goose|venison|rabbit|liver|kidneys?|oxtail|brisket|gelatine?|lard|suet|meatballs?|beef stock|chicken stock|bone broth|guanciale|frankfurters?|hot dogs?|spam|corned beef|pheasant|quail|pigeon|bresaola|pastrami|black pudding|tripe|offal|bone marrow|foie gras|lardons|kielbasa|merguez|nduja|morcilla|mortadella|bratwurst|jam[oó]n|serrano|speck|jerky|biltong)\b/;
const FISH =
  /\b(fish|salmon|tuna|cod|haddock|mackerel|sardines?|anchov(y|ies)|prawns?|shrimps?|crab|lobster|mussels?|clams?|oysters?|scallops?|squid|octopus|calamari|monkfish|tilapia|trout|halibut|sea bass|kippers?|caviar|roe|bonito|dashi|fish sauce|oyster sauce|saltfish|hake|pollock|snapper|swordfish|eel|pilchards?|herring|sprats?|whitebait|kingfish|catfish|sole|plaice|turbot|carp|conch|crayfish|langoustines?|cockles|cuttlefish|smoked fish|fish fillets?)\b/;
const HIDDEN_ANIMAL = /\b(worcestershire|fish sauce|oyster sauce|anchov)/; // not vegetarian
const DAIRY =
  /\b(milk|butter|cream|cheese|cheddar|parmesan|parmigiano|mozzarella|ricotta|mascarpone|feta|brie|gouda|gruy[eè]re|halloumi|paneer|yogh?urt|ghee|cr[eè]me fra[iî]che|custard|buttermilk|whey|quark|curd|kefir|ice cream|stilton|camembert|emmental|monterey jack|pecorino|double cream|single cream|sour cream|condensed milk|evaporated milk|labneh|skyr|fromage frais)\b/;
const DAIRY_SAFE =
  /\b(coconut|almond|oat|soy|soya|rice|cashew|plant|vegan|dairy[- ]free) (milk|cream|yogh?urt|butter|cheese)\b|\bpeanut butter\b|\bbutter ?beans?\b|\bbutternut( squash)?\b|\bcream of tartar\b|\bcream crackers?\b|\bcocoa butter\b|\bnut butter\b|\balmond butter\b/g;
const EGG = /\b(eggs?|egg (yolks?|whites?)|mayonnaise|mayo|meringue|aioli)\b/;
const EGG_SAFE = /\beggplants?\b|\begg[- ]free\b|\bvegan mayo(nnaise)?\b/g;
const HONEY = /\bhoney\b/;
const GLUTEN =
  /\b(flour|bread|breadcrumbs|pasta|spaghetti|penne|macaroni|lasagne|lasagna|noodles|couscous|bulgur|barley|rye|semolina|wheat|pastry|filo|phyllo|tortillas?|pitt?a|baguette|brioche|buns?|biscuits?|crackers?|digestives?|soy sauce|beer|ale|malt|seitan|udon|ramen|orzo|gnocchi|croissants?|naan|crumpets?|panko|farro|spelt|vermicelli|fettuccine|linguine|tagliatelle|rigatoni|fusilli|farfalle|ravioli|tortellini|cake|wafers?|oats)\b/;
const GLUTEN_SAFE =
  /\b(rice|corn|almond|coconut|chickpea|gram|potato|tapioca|buckwheat|gluten[- ]free|cassava|sorghum|teff|millet|oat) ?(flour|noodles?|tortillas?|starch|pasta|vermicelli|bread)\b|\bcornflour\b|\bcorn ?starch\b|\brice vermicelli\b|\btamari\b|\bgluten[- ]free [a-z ]+/g;
const NUTS =
  /\b(almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|macadamias?|brazil nuts?|pine nuts?|peanuts?|peanut butter|nuts?|praline|marzipan|nutella|frangipane|amaretto|satay|gianduja|almond (flour|milk|extract|butter)|ground almonds|flaked almonds|chestnuts?)\b/;
const NUTS_SAFE = /\bnutmeg\b|\bcoconut\b|\bbutternut\b|\bdough?nuts?\b|\bwater chestnuts?\b|\bnutritional yeast\b/g;
const HIGH_CARB =
  /\b(pasta|spaghetti|penne|macaroni|lasagne|noodles|rice|bread|flour|potato(es)?|sugar|couscous|tortillas?|buns?|baguette|oats|cornmeal|polenta|honey|maple syrup|quinoa|bulgur|gnocchi|pastry|puff pastry|filo|naan|pitt?a|plantains?|sweet potato(es)?|yams?|breadcrumbs|syrup|beans|lentils|chickpeas)\b/;
const PORK = /\b(pork|bacon|ham|prosciutto|pancetta|chorizo|salami|pepperoni|lard|guanciale|gelatine?|pork sausages?|sausages?|spam)\b/;
const ALCOHOL =
  /\b(wine|beer|rum|brandy|vodka|whisky|whiskey|sherry|port|cognac|liqueur|kirsch|marsala|sake|mirin|ale|stout|cider|bourbon|tequila|gin|amaretto|grand marnier|cointreau|calvados|champagne|prosecco|vermouth|shaoxing|baileys|kahlua|ouzo|raki|pastis|madeira|limoncello)\b/;
const ALCOHOL_SAFE = /\b(?:(?:red|white|rice|cider|sherry|malt|balsamic)\s+)?(?:wine\s+)?vinegar\b|\bginger(?: ale)?\b/g;

function test(names: string[], re: RegExp, safe?: RegExp): boolean {
  return names.some((n) => {
    const clean = safe ? n.replace(safe, ' ') : n;
    return re.test(clean);
  });
}

function lower(names: string[]): string[] {
  return names.map((n) => n.toLowerCase());
}

export function hasMeat(names: string[]): boolean {
  const l = lower(names);
  return test(l, MEAT) || test(l, HIDDEN_ANIMAL);
}

export function hasFish(names: string[]): boolean {
  return test(lower(names), FISH);
}

/** Return the first diet the ingredient list breaks, or null if it passes them all. */
export function violatesDiet(ingredientNames: string[], diets: string[], category?: string): string | null {
  const n = lower(ingredientNames);
  for (const diet of diets) {
    switch (diet) {
      case 'vegetarian':
        if (test(n, MEAT) || test(n, FISH) || test(n, HIDDEN_ANIMAL)) return diet;
        break;
      case 'vegan':
        if (test(n, MEAT) || test(n, FISH) || test(n, HIDDEN_ANIMAL) || test(n, DAIRY, DAIRY_SAFE) || test(n, EGG, EGG_SAFE) || test(n, HONEY))
          return diet;
        break;
      case 'pescatarian':
        if (test(n, MEAT)) return diet;
        break;
      case 'gluten-free':
        if (test(n, GLUTEN, GLUTEN_SAFE)) return diet;
        break;
      case 'dairy-free':
        if (test(n, DAIRY, DAIRY_SAFE)) return diet;
        break;
      case 'nut-free':
        if (test(n, NUTS, NUTS_SAFE)) return diet;
        break;
      case 'egg-free':
        if (test(n, EGG, EGG_SAFE)) return diet;
        break;
      case 'low-carb':
        if (category === 'Dessert' || test(n.slice(0, 8), HIGH_CARB)) return diet;
        break;
      case 'no-pork':
        if (test(n, PORK) || category === 'Pork') return diet;
        break;
      case 'no-alcohol':
        if (test(n, ALCOHOL, ALCOHOL_SAFE)) return diet;
        break;
    }
  }
  return null;
}

/** Does any ingredient match one of the user's free-text words (e.g. "olives")? */
export function mentionsAny(ingredientNames: string[], words: string[]): string[] {
  const n = lower(ingredientNames);
  const matches = (stem: string) => {
    const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    return n.some((name) => re.test(name));
  };
  return words.filter((w) => {
    const word = w.toLowerCase().trim();
    if (!word) return false;
    if (matches(word.replace(/(es|s)$/, ''))) return true;
    // "ground beef" should still find "Minced Beef".
    const last = word.split(/\s+/).pop()!;
    return last !== word && last.length > 3 && matches(last.replace(/(es|s)$/, ''));
  });
}
