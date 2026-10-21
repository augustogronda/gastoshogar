export const REVIEW_FLAG_TAG = "[POR_REVISAR]";
export const REVIEW_FLAG_REGEX = /\[POR_REVISAR\]/gi;
export const CARD_TAG_REGEX = /\[Tarjeta\s*([^\]]*)\]/i;

/**
 * Verifica si un gasto tiene la marca de revisión pendiente (ej. importado desde resumen de tarjeta)
 */
export function hasReviewFlag(notes?: string | null): boolean {
  if (!notes) return false;
  return REVIEW_FLAG_REGEX.test(notes) || notes.includes("[REVISAR]") || notes.includes("[POR_REVISAR]");
}

/**
 * Agrega la marca de revisión a las notas, preservando el contenido previo y agregando tarjeta si corresponde
 */
export function addReviewFlag(notes?: string | null, sourceCard?: string): string {
  const clean = removeReviewFlag(notes);
  const cardTag = sourceCard ? `[Tarjeta ${sourceCard.trim()}] ` : "";
  const prefix = `[POR_REVISAR] ${cardTag}`.trim();
  if (!clean) return prefix;
  return `${prefix} - ${clean}`;
}

/**
 * Quita la marca de revisión manteniendo el resto de las notas
 */
export function removeReviewFlag(notes?: string | null): string {
  if (!notes) return "";
  const result = notes
    .replace(REVIEW_FLAG_REGEX, "")
    .replace(/\[REVISAR\]/gi, "")
    .replace(/^\s*-\s*/, "")
    .trim();
  return result;
}

/**
 * Obtiene las notas limpias para visualización amigable (sin tags internos)
 */
export function getCleanNotes(notes?: string | null): string {
  if (!notes) return "";
  const result = notes
    .replace(REVIEW_FLAG_REGEX, "")
    .replace(/\[REVISAR\]/gi, "")
    .replace(CARD_TAG_REGEX, "")
    .replace(/^\s*-\s*/, "")
    .trim();
  return result;
}

/**
 * Extrae la tarjeta asociada si figura en los tags de las notas
 */
export function getCardSourceTag(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(CARD_TAG_REGEX);
  return match && match[1] ? match[1].trim() : null;
}
