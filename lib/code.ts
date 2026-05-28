// Short, readable, ambiguous-char-free room codes.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

export function generateRoomCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
