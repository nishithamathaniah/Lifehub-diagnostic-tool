import { Topic } from "../types.js";

export const TOPICS: Topic[] = [
  {
    id: "fractions-division",
    strand: "Number & Algebra",
    name: "Fractions and Division",
    shortLabel: "Fractions & Division",
    dependsOn: [],
  },
  {
    id: "four-operations-fractions",
    strand: "Number & Algebra",
    name: "Four Operations of Fractions",
    shortLabel: "4 Ops of Fractions",
    dependsOn: ["fractions-division"],
  },
];
