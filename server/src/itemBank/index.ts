import { Item, CPAStage, BloomLevel } from "../types.js";
import { FRACTIONS_DIVISION_ITEMS } from "./fractionsDivision.js";
import { FOUR_OPERATIONS_FRACTIONS_ITEMS } from "./fourOperationsFractions.js";
import { TOPICS } from "./topics.js";

export const ALL_ITEMS: Item[] = [...FRACTIONS_DIVISION_ITEMS, ...FOUR_OPERATIONS_FRACTIONS_ITEMS];

export { TOPICS };

export function getTopic(topicId: string) {
  const topic = TOPICS.find((t) => t.id === topicId);
  if (!topic) throw new Error(`Unknown topic ${topicId}`);
  return topic;
}

export function findItem(topicId: string, cpa: CPAStage, bloom: BloomLevel): Item | undefined {
  return ALL_ITEMS.find((it) => it.topicId === topicId && it.cpa === cpa && it.bloom === bloom);
}

export function getItemById(itemId: string): Item {
  const item = ALL_ITEMS.find((it) => it.id === itemId);
  if (!item) throw new Error(`Unknown item ${itemId}`);
  return item;
}

/** Client never receives correctChoiceId up front. */
export type ClientItem = ReturnType<typeof sanitizeItemForClient>;

export function sanitizeItemForClient(item: Item) {
  const shuffled = [...item.choices].sort(() => Math.random() - 0.5);
  return {
    id: item.id,
    topicId: item.topicId,
    cpa: item.cpa,
    bloom: item.bloom,
    subskill: item.subskill,
    prompt: item.prompt,
    representation: item.representation,
    choices: shuffled.map((c) => ({ id: c.id, text: c.text })),
  };
}
