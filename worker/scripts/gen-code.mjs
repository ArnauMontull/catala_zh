// Genera un código de acceso XXXX-XXXX-XXXX sin caracteres ambiguos (sin 0/O, 1/I/L, 5/S, 2/Z, 8/B).
// Uso: npm run gen-code   (o: npm run gen-code -- 3  para generar varios)
import { randomInt } from "node:crypto";

const ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679"; // 25 símbolos → ~55.7 bits por código
const n = Number.parseInt(process.argv[2] ?? "1", 10) || 1;

for (let k = 0; k < n; k++) {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(s);
  }
  console.log(groups.join("-"));
}
