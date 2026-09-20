// Parses set-electrician shorthand wattage into an integer watt value.
// "4k" -> 4000, "1.2k" -> 1200, "800" -> 800, "800w" -> 800
export function parseWattage(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim().toLowerCase();
    if (s === '') return null;

    const kMatch = s.match(/^(\d+(?:\.\d+)?)\s*k$/);
    if (kMatch) {
        return Math.round(parseFloat(kMatch[1]) * 1000);
    }

    const plain = s.match(/^(\d+(?:\.\d+)?)\s*w?$/);
    if (plain) {
        return Math.round(parseFloat(plain[1]));
    }

    throw new Error(`Cannot parse wattage: "${raw}"`);
}
