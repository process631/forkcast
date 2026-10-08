import type { MealId, SkillId, TimeId } from '../lib/types';

/**
 * The food taxonomy behind the wizard.
 *
 * It follows how most recipe sites organize food (Allrecipes, BBC Good Food, NYT Cooking,
 * TheMealDB): meal/course → dish type or main ingredient → cuisine → diet → time & effort.
 * Each category carries the rules the free matching engine uses to find library recipes,
 * plus one category-specific follow-up question.
 */

export interface Option {
  id: string;
  label: string;
  emoji?: string;
  hint?: string;
}

/** An answer option that can be matched against a recipe's text. */
export interface MatchOption extends Option {
  /** Tested against title + tags + ingredients + instructions. */
  re?: RegExp;
  /** Tested against the title only (a stronger signal). */
  titleRe?: RegExp;
  /** TheMealDB categories that count as a match. */
  cats?: string[];
  /** If this matches the recipe text, the option does not match (e.g. "no oven" vs. "bake"). */
  notRe?: RegExp;
  /** Words used to describe this option to the AI chef. */
  ai?: string;
}

export interface CategoryRule {
  /** TheMealDB categories that belong here. */
  cats?: string[];
  titleRe?: RegExp;
  /** TheMealDB tags (case-insensitive) that belong here. */
  tags?: string[];
  /** Tested against main ingredient names (stocks and sauces excluded). */
  ingRe?: RegExp;
  /** The recipe must also be (or must not be) a sweet dish. */
  sweet?: boolean;
  /** Extra built-in rule handled by the matching engine. */
  special?: 'vegetarian' | 'vegan' | 'light' | 'comfort' | 'spicy' | 'any';
  /** Titles that should never match even if other signals do. */
  excludeTitleRe?: RegExp;
}

export interface Question {
  id: string;
  title: string;
  subtitle?: string;
  multi: boolean;
  options: MatchOption[];
}

export interface CategoryDef extends Option {
  /** Short description shown on the card. */
  hint: string;
  rule: CategoryRule;
  question?: Question;
  /** How to describe this category to the AI chef. */
  ai: string;
}

export interface MealDef extends Option {
  hint: string;
  /** Category ids shown first for this meal, in order. Others appear under "More ideas". */
  categories: string[];
}

export const MEALS: MealDef[] = [
  {
    id: 'breakfast',
    label: 'Breakfast & Brunch',
    emoji: '🍳',
    hint: 'Eggs, pancakes, bakes & more',
    categories: ['eggs', 'pancakes', 'sweet', 'baking', 'sandwiches', 'savory', 'light', 'vegetarian', 'surprise'],
  },
  {
    id: 'lunch',
    label: 'Lunch',
    emoji: '🥪',
    hint: 'Sandwiches, salads, soups, bowls',
    categories: ['sandwiches', 'salads', 'soups', 'pasta', 'rice', 'chicken', 'seafood', 'vegetarian', 'light', 'savory', 'surprise'],
  },
  {
    id: 'dinner',
    label: 'Dinner',
    emoji: '🍽️',
    hint: 'Mains for tonight',
    categories: ['pasta', 'chicken', 'meat', 'seafood', 'curry', 'comfort', 'rice', 'vegetarian', 'vegan', 'soups', 'savory', 'surprise'],
  },
  {
    id: 'side',
    label: 'Side Dish',
    emoji: '🥗',
    hint: 'Veggies, potatoes, rice, breads',
    categories: ['veg-sides', 'salads', 'rice', 'baking', 'vegetarian', 'light', 'savory', 'surprise'],
  },
  {
    id: 'snack',
    label: 'Snack & Appetizer',
    emoji: '🧆',
    hint: 'Bites, dips & party food',
    categories: ['bites', 'sweet', 'baking', 'sandwiches', 'chicken', 'seafood', 'vegetarian', 'surprise'],
  },
  {
    id: 'dessert',
    label: 'Dessert',
    emoji: '🍰',
    hint: 'Cakes, cookies, puddings & more',
    categories: ['cakes', 'cookies', 'chocolate', 'fruity', 'pies', 'puddings', 'pancakes', 'vegan', 'surprise'],
  },
];

const OVEN_QUESTION: Question = {
  id: 'oven',
  title: 'Happy to turn the oven on?',
  multi: false,
  options: [
    { id: 'bake', label: 'Yes, let’s bake', emoji: '🔥', re: /\b(oven|bake|baking|baked)\b/, ai: 'baked in the oven' },
    { id: 'nobake', label: 'No oven, please', emoji: '❄️', re: /\b(no[- ]bake|chill|refrigerat|fridge|freez|set in|stovetop|saucepan)/, notRe: /\b(oven|bake|baking|baked)\b/, ai: 'no oven needed (no-bake or stovetop)' },
    { id: 'either', label: 'Either is fine', emoji: '🤷' },
  ],
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'savory',
    label: 'Savory & Hearty',
    emoji: '🍲',
    hint: 'Satisfying, salty, filling',
    ai: 'a savory, satisfying dish',
    rule: { sweet: false, special: 'any' },
    question: {
      id: 'style',
      title: 'What sounds best right now?',
      multi: true,
      options: [
        { id: 'saucy', label: 'Saucy', emoji: '🥘', re: /\b(sauce|gravy|curry|braise|stew|simmer)/, ai: 'saucy' },
        { id: 'crispy', label: 'Crispy', emoji: '🍟', re: /\b(crisp|crispy|fry|fried|crunch|breaded|panko|breadcrumbs)/, ai: 'crispy' },
        { id: 'roasted', label: 'Roasted / baked', emoji: '🔥', re: /\b(roast|bake|baked|oven)\b/, ai: 'roasted or baked' },
        { id: 'onepot', label: 'One-pot', emoji: '🫕', re: /\b(one[- ]pot|casserole|stew|tray ?bake|slow cooker|skillet|dutch oven)/, ai: 'one-pot' },
        { id: 'grilled', label: 'Grilled', emoji: '♨️', re: /\b(grill|grilled|bbq|barbecue|char|griddle|skewer)/, ai: 'grilled' },
      ],
    },
  },
  {
    id: 'sweet',
    label: 'Sweet Treats',
    emoji: '🍩',
    hint: 'Something sweet',
    ai: 'something sweet',
    rule: { sweet: true, special: 'any' },
    question: {
      id: 'style',
      title: 'What kind of sweet?',
      multi: true,
      options: [
        { id: 'chocolate', label: 'Chocolate', emoji: '🍫', re: /\b(chocolate|cocoa|nutella|brownie)/, ai: 'chocolatey' },
        { id: 'fruity', label: 'Fruity', emoji: '🍓', re: /\b(apple|berr|banana|lemon|orange|peach|cherr|mango|pear|plum|fruit|rhubarb|pineapple|apricot|fig)/, ai: 'fruity' },
        { id: 'cakes', label: 'Cakes & bakes', emoji: '🧁', titleRe: /\b(cake|muffin|loaf|bun|scone|sponge|roll)/, ai: 'a cake or bake' },
        { id: 'cookies', label: 'Cookies & bars', emoji: '🍪', titleRe: /\b(cookie|biscuit|brownie|bar|flapjack|shortbread|blondie|fudge|slice)/, ai: 'cookies or bars' },
        { id: 'creamy', label: 'Creamy & pudding', emoji: '🍮', titleRe: /\b(pudding|custard|cream|mousse|cheesecake|panna|trifle|tiramisu|fool|flan)/, ai: 'creamy pudding-style' },
      ],
    },
  },
  {
    id: 'sandwiches',
    label: 'Sandwiches, Burgers & Wraps',
    emoji: '🥪',
    hint: 'Handheld & stacked',
    ai: 'a sandwich, burger, wrap or taco',
    rule: {
      // JS \b only understands ASCII letters, so "bánh mì" sits outside the \b group.
      titleRe: /\b(sandwich|burgers?|wraps?|wrapped|toastie|panini|sub|tacos?|burrito|quesadilla|pitt?a|shawarma|gyros?|sloppy joe|croque|num pang|chivito|bagel|melt|sliders?|hot dog|po'? ?boy|cuban|club)\b|b[aá]nh m[iì]/,
      excludeTitleRe: /\b(brie wrapped|bowls?)\b/,
    },
    question: {
      id: 'style',
      title: 'Which kind?',
      multi: true,
      options: [
        { id: 'hot', label: 'Hot & toasty', emoji: '🔥', re: /\b(toast|grill|melt|panini|press|fried|fry|griddle)/, ai: 'hot and toasty' },
        { id: 'burger', label: 'Burgers', emoji: '🍔', titleRe: /burger|slider/, ai: 'a burger' },
        { id: 'wrap', label: 'Wraps & tacos', emoji: '🌯', titleRe: /\b(wrap|taco|burrito|tortilla|pitt?a|shawarma|quesadilla|gyro)/, ai: 'a wrap or taco' },
        { id: 'sub', label: 'Subs & bánh mì', emoji: '🥖', titleRe: /\b(b[aá]nh m[iì]|baguette|sub|roll|hoagie|cuban|num pang|chivito)/, ai: 'a sub or bánh mì' },
      ],
    },
  },
  {
    id: 'pasta',
    label: 'Pasta & Noodles',
    emoji: '🍝',
    hint: 'Twirly comfort',
    ai: 'a pasta or noodle dish',
    rule: {
      cats: ['Pasta'],
      titleRe: /\b(pasta|spaghetti|penne|lasagn[ae]|macaroni|mac (and|&|n) cheese|fettucc?ine|linguine|ravioli|gnocchi|noodles?|ramen|pho|lo mein|chow mein|pad thai|udon|soba|tagliatelle|carbonara|bolognese|orzo|tortellini|rigatoni|fusilli|farfalle|pappardelle|laksa)\b/,
      excludeTitleRe: /\b(vermicelli rice|rice paper)\b/,
      ingRe: /\b(spaghetti|penne|lasagne sheets|macaroni|fettuccine|linguine|rigatoni|fusilli|farfalle|tagliatelle|egg noodles|rice noodles|udon|ramen|soba|noodles|orzo|pasta)\b/,
    },
    question: {
      id: 'style',
      title: 'What sauce style?',
      multi: true,
      options: [
        { id: 'creamy', label: 'Creamy & cheesy', emoji: '🧀', re: /\b(cream|cheese|alfredo|carbonara|parmesan|parmigiano|mascarpone|ricotta)/, ai: 'creamy and cheesy' },
        { id: 'tomato', label: 'Tomato-based', emoji: '🍅', re: /\b(tomato|marinara|arrabbiata|arrabiata|bolognese|rag[uù]|passata|puttanesca)/, ai: 'tomato-based' },
        { id: 'oil', label: 'Garlic, oil & pesto', emoji: '🫒', re: /\b(pesto|aglio|olive oil|garlic)\b/, ai: 'garlic, olive oil or pesto' },
        { id: 'baked', label: 'Baked pasta', emoji: '🔥', re: /\b(bake|baked|lasagn|oven|gratin)/, ai: 'a baked pasta' },
        { id: 'noodles', label: 'Asian noodles', emoji: '🥢', re: /\b(noodles?|ramen|pho|udon|soba|stir[- ]?fry|pad thai|chow mein|lo mein|soy sauce)/, ai: 'an Asian-style noodle dish' },
      ],
    },
  },
  {
    id: 'meat',
    label: 'Beef, Pork & Lamb',
    emoji: '🥩',
    hint: 'Steaks, roasts, mince',
    ai: 'a beef, pork or lamb dish',
    rule: {
      cats: ['Beef', 'Pork', 'Lamb', 'Goat'],
      ingRe: /\b(beef|steak|mince|minced meat|pork|bacon|ham|sausages?|chorizo|lamb|mutton|goat|veal|brisket|ribs)\b/,
    },
    question: {
      id: 'style',
      title: 'Which meat?',
      multi: true,
      options: [
        { id: 'beef', label: 'Beef', emoji: '🐄', cats: ['Beef'], re: /\b(beef|steak|brisket|minced beef|ground beef)\b/, ai: 'beef' },
        { id: 'pork', label: 'Pork', emoji: '🐖', cats: ['Pork'], re: /\b(pork|bacon|ham|sausages?|chorizo|prosciutto|pancetta)\b/, ai: 'pork' },
        { id: 'lamb', label: 'Lamb', emoji: '🐑', cats: ['Lamb', 'Goat'], re: /\b(lamb|mutton|goat)\b/, ai: 'lamb' },
      ],
    },
  },
  {
    id: 'chicken',
    label: 'Chicken & Poultry',
    emoji: '🍗',
    hint: 'Weeknight hero',
    ai: 'a chicken or poultry dish',
    rule: { cats: ['Chicken'], ingRe: /\b(chicken|turkey|duck)\b/ },
    question: {
      id: 'style',
      title: 'How do you want your chicken?',
      multi: true,
      options: [
        { id: 'crispy', label: 'Crispy & fried', emoji: '🍟', re: /\b(crisp|fry|fried|breaded|panko|batter|breadcrumbs)/, ai: 'crispy or fried' },
        { id: 'roast', label: 'Roasted & baked', emoji: '🔥', re: /\b(roast|bake|baked|oven|tray)/, ai: 'roasted or baked' },
        { id: 'saucy', label: 'Saucy & curried', emoji: '🍛', re: /\b(curry|sauce|braise|simmer|stew|casserole|masala)/, ai: 'in a sauce or curry' },
        { id: 'grilled', label: 'Grilled & BBQ', emoji: '♨️', re: /\b(grill|bbq|barbecue|char|skewer|kebab|griddle)/, ai: 'grilled or BBQ' },
        { id: 'stirfry', label: 'Quick stir-fry', emoji: '🥢', re: /\b(stir[- ]?fry|wok|soy sauce)/, ai: 'a quick stir-fry' },
      ],
    },
  },
  {
    id: 'seafood',
    label: 'Fish & Seafood',
    emoji: '🐟',
    hint: 'Fish, shrimp & shellfish',
    ai: 'a fish or seafood dish',
    rule: {
      cats: ['Seafood'],
      ingRe: /\b(salmon|prawns?|shrimps?|cod|tuna|fish|crab|mussels?|squid|haddock|mackerel|scallops?|clams?|lobster|sardines?|trout|sea bass|monkfish|tilapia|halibut|saltfish|octopus)\b/,
    },
    question: {
      id: 'style',
      title: 'Which seafood?',
      multi: true,
      options: [
        { id: 'white', label: 'White fish', emoji: '🐟', re: /\b(cod|haddock|hake|pollock|tilapia|sea bass|monkfish|white fish|halibut|bream|saltfish|snapper)\b/, ai: 'white fish' },
        { id: 'salmon', label: 'Salmon & tuna', emoji: '🍣', re: /\b(salmon|tuna|trout|mackerel)\b/, ai: 'salmon or tuna' },
        { id: 'shrimp', label: 'Shrimp & prawns', emoji: '🦐', re: /\b(prawns?|shrimps?)\b/, ai: 'shrimp' },
        { id: 'shellfish', label: 'Shellfish & squid', emoji: '🦪', re: /\b(mussels?|clams?|scallops?|crab|lobster|oysters?|squid|octopus|calamari)\b/, ai: 'shellfish or squid' },
      ],
    },
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    emoji: '🥦',
    hint: 'No meat, all flavor',
    ai: 'a vegetarian dish',
    rule: { cats: ['Vegetarian', 'Vegan'], special: 'vegetarian', sweet: false },
    question: {
      id: 'style',
      title: 'What are you after?',
      multi: true,
      options: [
        { id: 'hearty', label: 'Hearty main', emoji: '🫘', re: /\b(beans?|lentils?|chickpeas?|potato|tofu|paneer|mushrooms?|aubergine|eggplant|halloumi)\b/, ai: 'a hearty main' },
        { id: 'cheesy', label: 'Cheesy', emoji: '🧀', re: /\b(cheese|cheddar|feta|mozzarella|halloumi|paneer|parmesan|ricotta)\b/, ai: 'cheesy' },
        { id: 'fresh', label: 'Fresh & light', emoji: '🥬', re: /\b(salad|fresh|herbs|lemon|lime|cucumber|mint)\b/, ai: 'fresh and light' },
        { id: 'carbs', label: 'Pasta, rice & grains', emoji: '🍚', re: /\b(pasta|rice|noodles?|couscous|quinoa|risotto|bulgur)\b/, ai: 'built on pasta, rice or grains' },
      ],
    },
  },
  {
    id: 'vegan',
    label: 'Plant-Based (Vegan)',
    emoji: '🌱',
    hint: 'No animal products',
    ai: 'a fully vegan (plant-based) dish',
    rule: { cats: ['Vegan'], special: 'vegan' },
    question: {
      id: 'style',
      title: 'What are you after?',
      multi: true,
      options: [
        { id: 'hearty', label: 'Hearty & filling', emoji: '🫘', re: /\b(beans?|lentils?|chickpeas?|potato|tofu|mushrooms?|aubergine|eggplant)\b/, ai: 'hearty and filling' },
        { id: 'fresh', label: 'Fresh & light', emoji: '🥬', re: /\b(salad|fresh|herbs|lemon|lime|cucumber|mint)\b/, ai: 'fresh and light' },
        { id: 'sweet', label: 'Something sweet', emoji: '🍓', cats: ['Dessert'], ai: 'a sweet treat' },
      ],
    },
  },
  {
    id: 'soups',
    label: 'Soups & Stews',
    emoji: '🥣',
    hint: 'Cozy bowls',
    ai: 'a soup or stew',
    rule: {
      tags: ['Soup', 'Stew'],
      titleRe: /\b(soup|stew|chowder|broth|bisque|gumbo|chil[il]i con carne|goulash|pho|ramen|hotpot|tagine|bourguignon|cassoulet|borscht|minestrone|laksa|congee|potage|caldo|pozole|ribollita|dal|dhal|daal|sopa|ciorba|shorba|harira|bouillabaisse|cock-a-leekie|scouse|hot pot)\b/,
    },
    question: {
      id: 'style',
      title: 'What kind of bowl?',
      multi: true,
      options: [
        { id: 'brothy', label: 'Light & brothy', emoji: '🍵', re: /\b(broth|stock|pho|ramen|miso|clear|consomm)/, ai: 'light and brothy' },
        { id: 'creamy', label: 'Smooth & creamy', emoji: '🥛', re: /\b(cream|blend|blender|puree|purée|smooth|bisque)/, ai: 'smooth and creamy' },
        { id: 'chunky', label: 'Chunky stew', emoji: '🍖', re: /\b(stew|casserole|chunks?|goulash|chil[il]i con carne|tagine|bourguignon|cassoulet)/, ai: 'a chunky stew' },
        { id: 'noodle', label: 'Noodle soup', emoji: '🍜', re: /\b(noodles?|ramen|pho|laksa|udon)/, ai: 'a noodle soup' },
      ],
    },
  },
  {
    id: 'salads',
    label: 'Salads & Bowls',
    emoji: '🥗',
    hint: 'Fresh & crunchy',
    ai: 'a salad or bowl',
    rule: { tags: ['Salad'], titleRe: /\b(salad|bowls?|slaw|poke|tabbouleh|fattoush|ceviche)\b/ },
    question: {
      id: 'style',
      title: 'What kind of salad or bowl?',
      multi: true,
      options: [
        { id: 'side', label: 'Light side', emoji: '🥬', cats: ['Side', 'Starter'], ai: 'a light side salad' },
        { id: 'main', label: 'Hearty with protein', emoji: '🍗', re: /\b(chicken|beef|steak|prawns?|salmon|eggs?|tuna|chickpeas?|chorizo|pork|halloumi|lentils?)\b/, ai: 'hearty with protein' },
        { id: 'grain', label: 'Grain & noodle bowl', emoji: '🍚', re: /\b(rice|quinoa|couscous|bowl|noodles?|bulgur)\b/, ai: 'a grain or noodle bowl' },
      ],
    },
  },
  {
    id: 'rice',
    label: 'Rice & Grains',
    emoji: '🍚',
    hint: 'Fried rice, risotto, pilaf',
    ai: 'a rice or grain dish',
    rule: {
      titleRe: /\b(rice|risotto|paella|pilaf|pilau|biryani|kedgeree|jambalaya|congee|quinoa|couscous|bulgur|arancini|sushi|bibimbap|plov|polenta|grits|kabsa|mandi|jollof|nasi|kitchari|khichdi|pulao|dolma)\b/,
      excludeTitleRe: /\brice (paper|noodles?|cakes?|wine|vinegar|pudding)\b/,
      ingRe: /^(rice|basmati rice|jasmine rice|arborio risotto rice|long grain rice|brown rice|quinoa|couscous|bulgur wheat|paella rice|sushi rice|white rice|wild rice)$/,
    },
    question: {
      id: 'style',
      title: 'Which style?',
      multi: true,
      options: [
        { id: 'fried', label: 'Fried rice & stir-fry', emoji: '🥢', re: /\b(fried rice|stir[- ]?fry|wok|soy sauce|nasi goreng)/, ai: 'fried rice or stir-fry' },
        { id: 'risotto', label: 'Risotto', emoji: '🧀', re: /\b(risotto|arborio|arancini)\b/, ai: 'a risotto' },
        { id: 'pilaf', label: 'Biryani & pilaf', emoji: '🍛', re: /\b(biryani|pilaf|pilau|plov|kabsa|mandi|pulao|jollof)\b/, ai: 'a biryani or pilaf' },
        { id: 'paella', label: 'Paella & jambalaya', emoji: '🥘', re: /\b(paella|jambalaya|gumbo|arroz)\b/, ai: 'a paella or jambalaya' },
        { id: 'grains', label: 'Other grains', emoji: '🌾', re: /\b(quinoa|couscous|bulgur|polenta|grits|barley|farro)\b/, ai: 'quinoa, couscous or other grains' },
      ],
    },
  },
  {
    id: 'eggs',
    label: 'Eggs',
    emoji: '🍳',
    hint: 'Omelettes, shakshuka, benedict',
    ai: 'an egg dish',
    rule: {
      titleRe: /\b(eggs?|omelett?e|frittata|shakshuka|quiche|benedict|tortilla espa[nñ]ola|spanish tortilla|foo young|huevos|scotch eggs?|lahsa|menemen|tamagoyaki|cilbir|çılbır|kuku)\b/,
      excludeTitleRe: /\b(eggplant|egg rolls?|egg noodles?)\b/,
    },
    question: {
      id: 'style',
      title: 'How do you like your eggs?',
      multi: true,
      options: [
        { id: 'omelette', label: 'Omelette & scrambled', emoji: '🍳', re: /\b(omelett?e|scrambl|whisk)/, ai: 'an omelette or scrambled eggs' },
        { id: 'baked', label: 'Baked in sauce', emoji: '🍅', re: /\b(shakshuka|frittata|quiche|baked|oven|menemen|lahsa)/, ai: 'baked eggs or eggs in sauce' },
        { id: 'poached', label: 'Poached & boiled', emoji: '🥚', re: /\b(poach|boil|benedict|soft-boiled|hard-boiled)/, ai: 'poached or boiled eggs' },
        { id: 'fried', label: 'Fried', emoji: '🔥', re: /\b(fry|fried)\b/, ai: 'fried eggs' },
      ],
    },
  },
  {
    id: 'pancakes',
    label: 'Pancakes, Waffles & French Toast',
    emoji: '🥞',
    hint: 'Weekend stacks',
    ai: 'pancakes, waffles, crêpes or French toast',
    rule: {
      titleRe: /\b(pancakes?|waffles?|cr[eê]pes?|french toast|torrijas?|poffertjes|blinis?|flija|hotcakes?|dutch baby|pikelets?|drop scones?|beignets?|mandazi|blintz(es)?|kaiserschmarrn)\b/,
      excludeTitleRe: /\bsavory pancake|banh xeo\b/,
    },
    question: {
      id: 'style',
      title: 'Which one?',
      multi: true,
      options: [
        { id: 'pancakes', label: 'Pancakes', emoji: '🥞', titleRe: /pancake|poffertjes|hotcake|pikelet|drop scone|dutch baby/, ai: 'pancakes' },
        { id: 'crepes', label: 'Crêpes', emoji: '🌯', titleRe: /cr[eê]pe|blini|blintz|flija/, ai: 'crêpes' },
        { id: 'toast', label: 'French toast', emoji: '🍞', titleRe: /french toast|torrija/, ai: 'French toast' },
        { id: 'waffles', label: 'Waffles', emoji: '🧇', titleRe: /waffle/, ai: 'waffles' },
      ],
    },
  },
  {
    id: 'baking',
    label: 'Baking & Breads',
    emoji: '🥐',
    hint: 'Breads, buns, pies',
    ai: 'something baked (bread, buns, pastry or pie)',
    rule: {
      tags: ['Baking', 'Bun', 'Pie', 'Tart', 'Cake', 'Bread'],
      titleRe: /\b(bread|buns?|loaf|scones?|muffins?|pies?|tarts?|cakes?|biscuits?|cookies?|brownies?|croissants?|pastry|pastries|focaccia|rolls?|brioche|pretzels?|bagels?|strudel|pasty|pasties|flatbreads?|naan|pita|cornbread|soda bread|galette|turnovers?|empanadas?|knish|börek|borek|burek|gužvara|khachapuri)\b/,
      excludeTitleRe: /\b(egg rolls?|spring rolls?|cabbage roll|fishcakes?|crab cakes?|pancakes?|potato cakes?|rice cakes?)\b/,
    },
    question: {
      id: 'style',
      title: 'What do you want to bake?',
      multi: true,
      options: [
        { id: 'bread', label: 'Bread & buns', emoji: '🍞', titleRe: /\b(bread|buns?|loaf|rolls?|focaccia|brioche|bagels?|pretzels?|naan|flatbread|pita)\b/, ai: 'bread or buns' },
        { id: 'savorypie', label: 'Savory pies & pastries', emoji: '🥧', titleRe: /\b(pie|pasty|pasties|quiche|empanada|börek|borek|burek|tart|galette|pastry|pastries)\b/, ai: 'a savory pie or pastry' },
        { id: 'sweetbake', label: 'Sweet bakes', emoji: '🧁', cats: ['Dessert'], ai: 'a sweet bake' },
        { id: 'noyeast', label: 'Quick (no yeast)', emoji: '⚡', ai: 'a quick bake with no yeast' },
      ],
    },
  },
  {
    id: 'curry',
    label: 'Curries & Spicy',
    emoji: '🌶️',
    hint: 'Bring the heat',
    ai: 'a curry or spicy dish',
    rule: {
      tags: ['Curry', 'Spicy', 'Chilli'],
      titleRe: /\b(curry|masala|vindaloo|korma|jalfrezi|tikka|dal|dhal|daal|rendang|laksa|jerk|madras|balti|massaman|sichuan|szechuan|kung pao|harissa|piri[- ]?piri|peri[- ]?peri|chil[il]i|katsu|biryani|rogan josh|saag|bhuna|dopiaza|tandoori|vindaloo|adobo|gochujang|buffalo|nihari|keema)\b/,
      special: 'spicy',
    },
    question: {
      id: 'style',
      title: 'How much heat?',
      multi: false,
      options: [
        { id: 'mild', label: 'Mild & creamy', emoji: '🥥', re: /\b(cream|coconut|korma|butter chicken|yogurt|yoghurt|cashew)/, ai: 'mild and creamy' },
        { id: 'medium', label: 'Medium warmth', emoji: '🌶️', re: /\b(curry|masala|tikka|cumin|garam)/, ai: 'medium spicy' },
        { id: 'hot', label: 'Bring the fire', emoji: '🔥', re: /\b(scotch bonnet|habanero|vindaloo|jerk|bird'?s eye|cayenne|chilli powder|chili powder|sichuan|szechuan|chipotle)/, ai: 'very spicy and hot' },
      ],
    },
  },
  {
    id: 'comfort',
    label: 'Comfort Food',
    emoji: '🧀',
    hint: 'Cozy classics',
    ai: 'a cozy comfort-food dish',
    rule: {
      tags: ['Calorific', 'Cheesy', 'Cheasy', 'Warming', 'UnHealthy', 'HangoverFood', 'Casserole', 'Pie'],
      titleRe: /\b(mac (and|&|n) cheese|macaroni|cheese|pies?|lasagn[ae]|casserole|gratin|stew|meatloaf|pot roast|shepherd|cottage|fried chicken|burgers?|pizza|fries|chips|chil[il]i con carne|dumplings?|roast|meatballs?|hotpot|toad in the hole|bangers|poutine|fish and chips|grilled cheese|pot pie|goulash|bake)\b/,
      sweet: false,
      special: 'comfort',
    },
    question: {
      id: 'style',
      title: 'What kind of comfort?',
      multi: true,
      options: [
        { id: 'cheesy', label: 'Cheesy & gooey', emoji: '🧀', re: /\b(cheese|cheddar|mozzarella|parmesan|gruy[eè]re)\b/, ai: 'cheesy and gooey' },
        { id: 'carbs', label: 'Carb-loaded', emoji: '🥔', re: /\b(potato|pasta|bread|rice|chips|fries|dumpling|mash)/, ai: 'carb-loaded' },
        { id: 'pie', label: 'Pies & bakes', emoji: '🥧', re: /\b(pie|bake|casserole|gratin|lasagn|pastry)/, ai: 'a pie or bake' },
        { id: 'fried', label: 'Fried & crispy', emoji: '🍗', re: /\b(fry|fried|crisp|batter|breaded)/, ai: 'fried and crispy' },
      ],
    },
  },
  {
    id: 'light',
    label: 'Light & Healthy',
    emoji: '🥬',
    hint: 'Fresh, lean, veggie-packed',
    ai: 'a light, healthy, veggie-forward dish',
    rule: {
      tags: ['Light', 'Paleo', 'Keto', 'LowCarbs', 'Salad', 'Summer', 'Vegan', 'Vegetarian'],
      titleRe: /\b(salad|steamed|grilled|poached|ceviche|bowl|broth|stir[- ]?fry|lettuce wraps?|zoodles|spiralized)\b/,
      special: 'light',
      sweet: false,
    },
    question: {
      id: 'style',
      title: 'What sounds good?',
      multi: true,
      options: [
        { id: 'salad', label: 'Big salad', emoji: '🥗', re: /\bsalad\b/, ai: 'a big salad' },
        { id: 'soup', label: 'Light soup', emoji: '🍵', re: /\b(soup|broth)\b/, ai: 'a light soup' },
        { id: 'lean', label: 'Lean protein', emoji: '🐟', re: /\b(chicken breast|fish|salmon|cod|prawns?|shrimps?|tofu|turkey|eggs?)\b/, ai: 'lean protein with veg' },
        { id: 'veg', label: 'Veggie-packed', emoji: '🥕', re: /\b(spinach|kale|broccoli|courgette|zucchini|peppers?|carrots?|cabbage|cauliflower|aubergine|eggplant|tomato)/, ai: 'veggie-packed' },
      ],
    },
  },
  {
    id: 'veg-sides',
    label: 'Veggies & Potatoes',
    emoji: '🥔',
    hint: 'Roasties, mash, greens',
    ai: 'a vegetable or potato side dish',
    rule: {
      titleRe: /\b(potato(es)?|veg|vegetables?|carrots?|cabbage|beans|greens|broccoli|cauliflower|aubergine|eggplant|mushrooms?|courgettes?|zucchini|squash|corn|asparagus|spinach|chips|fries|mash|roasted|gratin|plantains?|sprouts|peas|okra|kale|leeks?|beetroot|beets|parsnips?)\b/,
      sweet: false,
    },
    question: {
      id: 'style',
      title: 'Which kind of side?',
      multi: true,
      options: [
        { id: 'potato', label: 'Potatoes', emoji: '🥔', re: /\b(potato|potatoes|chips|fries|mash)\b/, ai: 'potatoes' },
        { id: 'roast', label: 'Roasted veg', emoji: '🔥', re: /\b(roast|roasted|oven|bake)/, ai: 'roasted vegetables' },
        { id: 'greens', label: 'Greens', emoji: '🥬', re: /\b(greens|spinach|kale|cabbage|broccoli|beans|asparagus|peas|sprouts)\b/, ai: 'green vegetables' },
        { id: 'fried', label: 'Fried & crispy', emoji: '🍟', re: /\b(fry|fried|crisp|fritter)/, ai: 'fried and crispy' },
      ],
    },
  },
  {
    id: 'bites',
    label: 'Bites, Dips & Finger Food',
    emoji: '🧆',
    hint: 'Party snacks & starters',
    ai: 'a snack, dip or finger food',
    rule: {
      cats: ['Starter'],
      tags: ['Snack', 'Streetfood', 'Onthego'],
      titleRe: /\b(dips?|fritters?|croquet(as|tes)?|wings|bites|balls|samosas?|spring rolls?|egg rolls?|empanadas?|nachos|hummus|houmous|crisps|skewers?|kebabs?|bruschetta|pakoras?|bhajis?|dumplings?|gyoza|sliders|tapenade|guacamole|salsa|deviled|devilled|briks?|falafel|arancini|tostones|acaraje|kofta|satay|pâté|pate|toasts?|stuffed)\b/,
    },
    question: {
      id: 'style',
      title: 'What kind of snack?',
      multi: true,
      options: [
        { id: 'crispy', label: 'Crispy & fried', emoji: '🍤', re: /\b(fry|fried|crisp|fritter|croquet|pakora|bhaji|samosa|spring roll)/, ai: 'crispy and fried' },
        { id: 'dip', label: 'Dips & spreads', emoji: '🥣', re: /\b(dip|hummus|houmous|guacamole|salsa|spread|pâté|pate|tapenade)/, ai: 'a dip or spread' },
        { id: 'stuffed', label: 'Stuffed & wrapped', emoji: '🥟', re: /\b(stuffed|wrapped|dumpling|empanada|samosa|roll|gyoza|parcel|brik)/, ai: 'stuffed or wrapped' },
        { id: 'skewer', label: 'Skewers & wings', emoji: '🍢', re: /\b(skewer|kebab|wings|satay|kofta)/, ai: 'skewers or wings' },
      ],
    },
  },
  {
    id: 'cakes',
    label: 'Cakes & Cupcakes',
    emoji: '🎂',
    hint: 'Layer cakes, loaves, muffins',
    ai: 'a cake, loaf or cupcakes',
    rule: {
      sweet: true,
      titleRe: /\b(cakes?|cupcakes?|sponge|gateau|g[aâ]teau|torte|loaf|muffins?|madeleines?|battenberg|bundt|lamingtons?|roulade|swiss roll|babka)\b/,
      excludeTitleRe: /\b(pancakes?|cheesecakes?)\b/,
    },
    question: OVEN_QUESTION,
  },
  {
    id: 'cookies',
    label: 'Cookies, Brownies & Bars',
    emoji: '🍪',
    hint: 'Bake-sale favorites',
    ai: 'cookies, brownies or bars',
    rule: {
      sweet: true,
      titleRe: /\b(cookies?|biscuits?|brownies?|blondies?|bars?|flapjacks?|shortbread|macaroons?|macarons?|biscotti|fudge|slices?|squares?|nanaimo|rocky road|krispie|truffles?|snickerdoodles?|cornes de gazelle)\b/,
    },
    question: OVEN_QUESTION,
  },
  {
    id: 'chocolate',
    label: 'Chocolate Everything',
    emoji: '🍫',
    hint: 'For the chocoholics',
    ai: 'a chocolate dessert',
    rule: { sweet: true, titleRe: /\b(chocolate|choc|cocoa|brownies?|nutella|mocha|devil'?s food|sacher)\b/, ingRe: /\b(chocolate|cocoa)\b/, tags: ['Chocolate'] },
    question: OVEN_QUESTION,
  },
  {
    id: 'fruity',
    label: 'Fruity Desserts',
    emoji: '🍓',
    hint: 'Berries, apples, citrus',
    ai: 'a fruity dessert',
    rule: {
      sweet: true,
      tags: ['Fruity'],
      titleRe: /\b(apples?|berry|berries|bananas?|lemons?|oranges?|peach(es)?|cherr(y|ies)|mangos?|mangoes|pears?|plums?|fruit|rhubarb|pineapple|apricots?|figs?|dates|limes?|coconut|passion ?fruit|raspberr(y|ies)|strawberr(y|ies)|blueberr(y|ies)|blackberr(y|ies)|cranberr(y|ies)|grapes?|kiwi|melon|quince|nectarines?|key lime|eton mess|summer pudding)\b/,
    },
    question: OVEN_QUESTION,
  },
  {
    id: 'pies',
    label: 'Pies, Tarts & Pastries',
    emoji: '🥧',
    hint: 'Flaky & buttery',
    ai: 'a sweet pie, tart, crumble or pastry',
    rule: {
      sweet: true,
      titleRe: /\b(pies?|tarts?|tarte|pastry|pastries|strudel|baklava|galette|crumble|cobbler|turnovers?|danish|[eé]clairs?|profiteroles?|mille|bakewell|clafoutis|choux|kolache|pasteis|pastel|tatin|frangipane|buns?|cinnamon rolls?)\b/,
    },
    question: OVEN_QUESTION,
  },
  {
    id: 'puddings',
    label: 'Puddings, Custards & Creamy',
    emoji: '🍮',
    hint: 'Spoonable & silky',
    ai: 'a pudding, custard, mousse, cheesecake or frozen dessert',
    rule: {
      sweet: true,
      tags: ['Pudding'],
      titleRe: /\b(puddings?|custards?|cream|mousse|cheesecakes?|panna cotta|trifle|tiramisu|fool|posset|syllabub|flan|br[uû]l[eé]e|sticky toffee|semolina|jelly|parfait|ice cream|sorbet|kulfi|halwa|kheer|rice pudding|pots? de cr[eè]me|bread and butter|sago|tapioca|malva|budino|eton mess|pavlova|meringue)\b/,
    },
    question: OVEN_QUESTION,
  },
  {
    id: 'surprise',
    label: 'Surprise Me',
    emoji: '🎲',
    hint: 'Anything goes',
    ai: 'anything delicious — surprise them',
    rule: { special: 'any' },
  },
];

export const MOODS: MatchOption[] = [
  { id: 'spicy', label: 'Spicy', emoji: '🌶️', re: /\b(chil[il]i|chillies|chilies|cayenne|jalape|sriracha|harissa|scotch bonnet|habanero|gochujang|curry|pepper flakes|chipotle|sambal|tabasco|hot sauce|wasabi|piri)/, ai: 'spicy' },
  { id: 'cheesy', label: 'Cheesy', emoji: '🧀', re: /\b(cheese|cheddar|parmesan|parmigiano|mozzarella|feta|gruy|halloumi|ricotta|brie|pecorino|paneer|mascarpone|emmental)/, ai: 'cheesy' },
  { id: 'fresh', label: 'Fresh & zesty', emoji: '🍋', re: /\b(lemon|lime|mint|coriander|cilantro|basil|parsley|dill|cucumber|salad|zest|herbs)\b/, ai: 'fresh, zesty and herby' },
  { id: 'creamy', label: 'Rich & creamy', emoji: '🥛', re: /\b(cream|coconut milk|cream cheese|butter|yogurt|yoghurt|mascarpone|cr[eè]me|custard)\b/, ai: 'rich and creamy' },
  { id: 'smoky', label: 'Smoky & charred', emoji: '🔥', re: /\b(grill|grilled|bbq|barbecue|smoked|smoky|smoked paprika|char|charred|chipotle|griddle)\b/, ai: 'smoky and charred' },
  { id: 'garlicky', label: 'Garlicky', emoji: '🧄', re: /\bgarlic\b/, ai: 'garlicky' },
  { id: 'crispy', label: 'Crispy & crunchy', emoji: '🥨', re: /\b(crisp|crispy|fry|fried|crunch|crunchy|breadcrumbs|panko|batter|golden)\b/, ai: 'crispy and crunchy' },
  { id: 'hearty', label: 'Hearty & filling', emoji: '🍖', re: /\b(potato|stew|beef|lamb|beans|lentils|casserole|pie|dumplings?|sausages?)\b/, ai: 'hearty and filling' },
  { id: 'sweetsavory', label: 'Sweet & savory', emoji: '🍯', re: /\b(honey|maple|brown sugar|teriyaki|hoisin|sweet chil|glaze|caramel|pineapple|chutney)/, ai: 'sweet-and-savory' },
];

export const TIMES: (Option & { id: TimeId; max: number; ai: string })[] = [
  { id: 'quick', label: 'Under 25 min', emoji: '⚡', hint: 'Fast & easy', max: 25, ai: 'under 25 minutes total' },
  { id: 'medium', label: 'About 45 min', emoji: '⏱️', hint: 'A normal weeknight', max: 45, ai: 'about 45 minutes total' },
  { id: 'long', label: 'Up to 1½ hours', emoji: '🕐', hint: 'Got some time', max: 90, ai: 'up to 90 minutes total' },
  { id: 'any', label: 'No rush', emoji: '🐢', hint: 'Slow cooking is fine', max: Infinity, ai: 'no time limit (slow or long recipes are fine)' },
];

export const SKILLS: (Option & { id: SkillId; ai: string })[] = [
  { id: 'easy', label: 'Keep it simple', emoji: '🙂', hint: 'Beginner friendly', ai: 'a beginner (keep techniques simple)' },
  { id: 'medium', label: 'I’m comfortable', emoji: '🔪', hint: 'Some technique is fine', ai: 'a comfortable home cook' },
  { id: 'hard', label: 'Challenge me', emoji: '🏆', hint: 'Bring on the project', ai: 'an adventurous cook who wants a challenge' },
  { id: 'any', label: 'Doesn’t matter', emoji: '🤷', ai: 'any skill level' },
];

export interface CuisineDef extends Option {
  countries: string[];
}

export const CUISINES: CuisineDef[] = [
  { id: 'italian', label: 'Italian', emoji: '🍕', countries: ['Italy'] },
  { id: 'mexican', label: 'Mexican & Latin', emoji: '🌮', countries: ['Mexico', 'Argentina', 'Venezuela', 'Uruguay', 'Colombia', 'Brazil', 'Chile', 'Costa Rica', 'Bolivia', 'Peru', 'Ecuador', 'Guatemala', 'El Salvador', 'Honduras', 'Nicaragua', 'Panama', 'Paraguay', 'Belize'] },
  { id: 'caribbean', label: 'Caribbean', emoji: '🌴', countries: ['Jamaica', 'Dominica', 'Barbados', 'Cayman Islands', 'Aruba', 'Antigua and Barbuda', 'Bahamas', 'Cuba', 'Bermuda', 'Trinidad and Tobago', 'Haiti', 'Dominican Republic', 'Puerto Rico', 'Grenada', 'Saint Lucia'] },
  { id: 'american', label: 'American & Canadian', emoji: '🍔', countries: ['United States', 'Canada'] },
  { id: 'british', label: 'British, Irish & Aussie', emoji: '🫖', countries: ['United Kingdom', 'Ireland', 'Australia', 'New Zealand'] },
  { id: 'french', label: 'French', emoji: '🥖', countries: ['France', 'Belgium'] },
  { id: 'spanish', label: 'Spanish & Portuguese', emoji: '🥘', countries: ['Spain', 'Portugal', 'Andorra'] },
  { id: 'mediterranean', label: 'Greek, Turkish & Middle Eastern', emoji: '🫒', countries: ['Greece', 'Turkey', 'Syria', 'Saudi Arabia', 'Lebanon', 'Cyprus', 'Israel', 'Jordan', 'Armenia', 'Azerbaijan', 'Iran', 'Iraq', 'Yemen', 'Bahrain', 'Kuwait', 'Oman', 'Qatar', 'United Arab Emirates', 'Palestine'] },
  { id: 'african', label: 'African', emoji: '🌍', countries: ['Morocco', 'Algeria', 'Tunisia', 'Egypt', 'Kenya', 'Botswana', 'Angola', 'Nigeria', 'Ghana', 'Ethiopia', 'South Africa', 'Senegal', 'Cameroon', 'Tanzania', 'Uganda', 'Benin', 'Burkina Faso', 'Burundi', 'Cape Verde', 'Central African Republic', 'Chad'] },
  { id: 'indian', label: 'Indian & South Asian', emoji: '🍛', countries: ['India', 'Bangladesh', 'Pakistan', 'Sri Lanka', 'Nepal', 'Afghanistan', 'Bhutan'] },
  { id: 'chinese', label: 'Chinese', emoji: '🥡', countries: ['China', 'Taiwan', 'Hong Kong'] },
  { id: 'japanese', label: 'Japanese & Korean', emoji: '🍣', countries: ['Japan', 'South Korea', 'Korea'] },
  { id: 'seasian', label: 'Southeast Asian', emoji: '🍜', countries: ['Thailand', 'Vietnam', 'Malaysia', 'Philippines', 'Cambodia', 'Laos', 'Indonesia', 'Singapore', 'Myanmar', 'Brunei'] },
  { id: 'european', label: 'Central, Eastern & Nordic European', emoji: '🥟', countries: ['Poland', 'Russia', 'Ukraine', 'Slovakia', 'Croatia', 'Bulgaria', 'Albania', 'Austria', 'Netherlands', 'Norway', 'Denmark', 'Estonia', 'Germany', 'Hungary', 'Czech Republic', 'Sweden', 'Finland', 'Romania', 'Serbia', 'Belarus', 'Bosnia and Herzegovina', 'Switzerland', 'Iceland', 'Lithuania', 'Latvia', 'Slovenia', 'Georgia'] },
];

export const DIETS: (Option & { ai: string })[] = [
  { id: 'vegetarian', label: 'Vegetarian', emoji: '🥕', ai: 'vegetarian (no meat or fish)' },
  { id: 'vegan', label: 'Vegan', emoji: '🌱', ai: 'vegan (no animal products at all)' },
  { id: 'pescatarian', label: 'Pescatarian', emoji: '🐟', ai: 'pescatarian (fish OK, no meat)' },
  { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾', ai: 'gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free', emoji: '🥛', ai: 'dairy-free' },
  { id: 'nut-free', label: 'Nut-free', emoji: '🥜', ai: 'nut-free (no peanuts or tree nuts)' },
  { id: 'egg-free', label: 'Egg-free', emoji: '🥚', ai: 'egg-free' },
  { id: 'low-carb', label: 'Low-carb', emoji: '🥩', ai: 'low-carb (no pasta, rice, bread, potatoes or sugar-heavy items)' },
  { id: 'no-pork', label: 'No pork', emoji: '🚫', ai: 'no pork' },
  { id: 'no-alcohol', label: 'No alcohol', emoji: '🍷', ai: 'no alcohol in the recipe' },
];

export const SERVINGS = [1, 2, 4, 6, 8];

export const QUICK_INGREDIENTS = ['chicken', 'ground beef', 'eggs', 'rice', 'pasta', 'potatoes', 'spinach', 'mushrooms', 'tomatoes', 'cheese', 'tofu', 'salmon', 'bananas', 'avocado'];

export function getMeal(id: string | null | undefined): MealDef | undefined {
  return MEALS.find((m) => m.id === id);
}

export function getCategory(id: string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function cuisineForCountry(country: string | null | undefined): CuisineDef | undefined {
  if (!country) return undefined;
  return CUISINES.find((c) => c.countries.includes(country));
}

/** Categories split into the ones recommended for this meal and the rest. */
export function categoriesForMeal(meal: MealId | null): { main: CategoryDef[]; more: CategoryDef[] } {
  const def = getMeal(meal);
  if (!def) return { main: CATEGORIES, more: [] };
  const main = def.categories.map((id) => getCategory(id)!).filter(Boolean);
  const dessertOnly = new Set(['cakes', 'cookies', 'chocolate', 'fruity', 'pies', 'puddings']);
  const more = CATEGORIES.filter((c) => !def.categories.includes(c.id) && (meal === 'dessert' || !dessertOnly.has(c.id)));
  return { main, more };
}
