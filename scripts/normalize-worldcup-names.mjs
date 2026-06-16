import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const replacements = [
  [/South Korea/g, "South Korea"],
  [/C\\u00f4te d'Ivoire/g, "Ivory Coast"],
  [/Ivory Coast/g, "Ivory Coast"],
  [/Cura\\u00e7ao/g, "Curacao"],
  [/Curacao/g, "Curacao"],
];

const files = [
  "data/markets.json",
  "data/world-cup-deployments.json",
  "data/world-cup-results.json",
];

for (const relativePath of files) {
  const filePath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(filePath)) {
    console.log(`Skip missing ${relativePath}`);
    continue;
  }

  const before = fs.readFileSync(filePath, "utf8");
  let after = before;

  for (const [pattern, replacement] of replacements) {
    after = after.replace(pattern, replacement);
  }

  if (after !== before) {
    fs.writeFileSync(filePath, after);
    console.log(`Normalized ${relativePath}`);
  } else {
    console.log(`No changes ${relativePath}`);
  }
}
