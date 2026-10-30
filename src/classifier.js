export const BIN_LABELS = Object.freeze({
  COMPOST: "Compost",
  RECYCLE: "Recycle",
  GENERAL: "General waste",
  SPECIAL: "Special handling",
  UNKNOWN: "Not sure",
});

const ITEMS = Object.freeze({
  COMPOST: [
    "banana peel", "apple core", "food scraps", "food waste", "vegetable scraps",
    "coffee grounds", "tea leaves", "eggshell", "orange peel", "fruit peel",
    "leftover food", "leaves", "grass clippings", "bread", "rice", "fruit", "vegetable",
  ],
  RECYCLE: [
    "plastic bottle", "glass bottle", "glass jar", "aluminum can", "tin can",
    "cardboard", "newspaper", "paper", "plastic", "metal can", "glass", "can", "jar",
  ],
  GENERAL: [
    "paper towel", "plastic wrapper", "candy wrapper", "chip bag", "food wrapper",
    "broken ceramic", "styrofoam", "foam", "wrapper", "tissue", "napkin", "diaper", "ceramic",
  ],
});

const SPECIAL_ITEMS = [
  "lithium battery", "rechargeable battery", "battery", "batteries", "electronics",
  "phone", "laptop", "paint", "chemical", "aerosol", "light bulb", "fluorescent bulb",
];

function cleanText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function findPhrase(text, phrase) {
  const paddedText = ` ${text} `;
  const index = paddedText.indexOf(` ${phrase} `);
  return index < 0 ? null : { start: index, end: index + phrase.length + 2 };
}

export function classifyWaste(input) {
  const text = cleanText(input);
  if (!text) {
    return { category: "UNKNOWN", label: BIN_LABELS.UNKNOWN, reason: "Say or type one item to classify it." };
  }

  const specialMatch = SPECIAL_ITEMS.find((phrase) => findPhrase(text, phrase));
  if (specialMatch) {
    return {
      category: "SPECIAL",
      label: BIN_LABELS.SPECIAL,
      matchedItem: specialMatch,
      reason: "This item may need a dedicated drop-off point. No bin was opened.",
    };
  }

  const matches = [];
  for (const [category, phrases] of Object.entries(ITEMS)) {
    for (const phrase of phrases) {
      const span = findPhrase(text, phrase);
      if (span) matches.push({ category, phrase, ...span });
    }
  }

  if (!matches.length) {
    return {
      category: "UNKNOWN",
      label: BIN_LABELS.UNKNOWN,
      reason: "I don’t recognize that item yet. No bin was opened.",
    };
  }

  // A specific phrase such as "plastic wrapper" overrides the broad
  // single-word match "plastic", but separate recognized items stay ambiguous.
  const specificMatches = matches.filter((match) => !matches.some((other) =>
    other.category !== match.category
    && other.phrase.length > match.phrase.length
    && other.start <= match.start
    && other.end >= match.end
  ));
  const categories = [...new Set(specificMatches.map((match) => match.category))];
  if (categories.length !== 1) {
    return {
      category: "UNKNOWN",
      label: BIN_LABELS.UNKNOWN,
      reason: "That sounds like more than one material. Try naming one item at a time; no bin was opened.",
    };
  }

  const category = categories[0];
  return {
    category,
    label: BIN_LABELS[category],
    matchedItem: specificMatches[0].phrase,
    reason: `Matched “${specificMatches[0].phrase}”.`,
  };
}
