export interface InvestmentPocket {
  id: string;
  name: string;
  icon: string;
  color: string; // 'emerald' | 'indigo' | 'amber' | 'cyan' | 'purple' | 'rose' | 'blue'
  targetAmountArs?: number;
  priority?: number; // 1 (Principal / Primero), 2, 3...
}

export const DEFAULT_POCKETS: InvestmentPocket[] = [
  {
    id: "fondo-emergencia",
    name: "Fondo Emergencia",
    icon: "🛡️",
    color: "emerald",
    priority: 1,
  },
  {
    id: "inversiones",
    name: "Inversiones",
    icon: "📈",
    color: "indigo",
    priority: 2,
  },
  {
    id: "fondo-auto",
    name: "Fondo para Auto",
    icon: "🚗",
    color: "amber",
    priority: 3,
  },
  {
    id: "vacaciones",
    name: "Vacaciones & Viajes",
    icon: "✈️",
    color: "cyan",
    priority: 4,
  },
  {
    id: "hogar-proyectos",
    name: "Hogar & Proyectos",
    icon: "🏠",
    color: "purple",
    priority: 5,
  },
];

export const FALLBACK_POCKET: InvestmentPocket = DEFAULT_POCKETS[1]; // Inversiones

export const POCKET_COLOR_MAP: Record<
  string,
  {
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    tabActive: string;
    accentText: string;
    dotBg: string;
    progressBg: string;
  }
> = {
  emerald: {
    badgeBg: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    badgeBorder: "border-emerald-500/30",
    tabActive: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25",
    accentText: "text-emerald-400",
    dotBg: "bg-emerald-400",
    progressBg: "bg-emerald-500",
  },
  indigo: {
    badgeBg: "bg-indigo-500/15",
    badgeText: "text-indigo-300",
    badgeBorder: "border-indigo-500/30",
    tabActive: "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-500/25",
    accentText: "text-indigo-400",
    dotBg: "bg-indigo-400",
    progressBg: "bg-indigo-500",
  },
  amber: {
    badgeBg: "bg-amber-500/15",
    badgeText: "text-amber-300",
    badgeBorder: "border-amber-500/30",
    tabActive: "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-500/25",
    accentText: "text-amber-400",
    dotBg: "bg-amber-400",
    progressBg: "bg-amber-500",
  },
  cyan: {
    badgeBg: "bg-cyan-500/15",
    badgeText: "text-cyan-300",
    badgeBorder: "border-cyan-500/30",
    tabActive: "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-cyan-500/25",
    accentText: "text-cyan-400",
    dotBg: "bg-cyan-400",
    progressBg: "bg-cyan-500",
  },
  purple: {
    badgeBg: "bg-purple-500/15",
    badgeText: "text-purple-300",
    badgeBorder: "border-purple-500/30",
    tabActive: "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-purple-500/25",
    accentText: "text-purple-400",
    dotBg: "bg-purple-400",
    progressBg: "bg-purple-500",
  },
  rose: {
    badgeBg: "bg-rose-500/15",
    badgeText: "text-rose-300",
    badgeBorder: "border-rose-500/30",
    tabActive: "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-rose-500/25",
    accentText: "text-rose-400",
    dotBg: "bg-rose-400",
    progressBg: "bg-rose-500",
  },
  blue: {
    badgeBg: "bg-blue-500/15",
    badgeText: "text-blue-300",
    badgeBorder: "border-blue-500/30",
    tabActive: "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-500/25",
    accentText: "text-blue-400",
    dotBg: "bg-blue-400",
    progressBg: "bg-blue-500",
  },
};

export const POCKET_TAG_REGEX = /\[BOLSA:\s*([^\]]+)\]/i;
export const POCKETS_DATA_REGEX = /\[POCKETS_DATA:\s*([^\]]+)\]/i;

/**
 * Inserta o actualiza el payload maestro de todas las bolsas en las notas de una inversión.
 */
export function injectMasterPocketsData(
  notes: string | null | undefined,
  pockets: InvestmentPocket[]
): string {
  const clean = notes ? notes.replace(POCKETS_DATA_REGEX, "").trim() : "";
  const payload = encodeURIComponent(JSON.stringify(pockets));
  const tag = `[POCKETS_DATA:${payload}]`;
  if (!clean) return tag;
  return `${tag} ${clean}`;
}

/**
 * Extrae la configuración maestra de bolsas si existe en las notas.
 */
export function extractMasterPocketsData(
  notes: string | null | undefined
): InvestmentPocket[] | null {
  if (!notes) return null;
  const match = notes.match(POCKETS_DATA_REGEX);
  if (!match) return null;
  try {
    const raw = match[1].trim();
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    console.warn("Error parseando POCKETS_DATA de notas:", e);
  }
  return null;
}

/**
 * Extrae la bolsa asignada a partir de las notas de la inversión.
 * Formatos soportados en [BOLSA:...]:
 * - [BOLSA:fondo-emergencia]
 * - [BOLSA:custom-id::Nombre::Icono::Color::MetaOpcional::Prioridad]
 */
export function extractPocketFromNotes(
  notes?: string | null,
  knownPockets: InvestmentPocket[] = []
): { pocket: InvestmentPocket; cleanNotes: string } {
  if (!notes) {
    return { pocket: FALLBACK_POCKET, cleanNotes: "" };
  }

  const match = notes.match(POCKET_TAG_REGEX);
  const cleanNotes = notes
    .replace(POCKET_TAG_REGEX, "")
    .replace(POCKETS_DATA_REGEX, "")
    .trim();

  if (!match) {
    return { pocket: FALLBACK_POCKET, cleanNotes };
  }

  const raw = match[1].trim();
  const parts = raw.split("::");
  const pocketId = parts[0]?.trim();

  // Buscar en lista conocida provista o en defaults como referencia base
  const known =
    knownPockets.find((p) => p.id === pocketId) ||
    DEFAULT_POCKETS.find((p) => p.id === pocketId);

  // 1. Si viene serializado con todos sus campos (ej: [BOLSA:id::Nombre::Icono::Color::Meta::Prioridad])
  if (parts.length >= 2) {
    const name = parts[1]?.trim() || known?.name || pocketId;
    const icon = parts[2]?.trim() || known?.icon || "💰";
    const color = parts[3]?.trim() || known?.color || "indigo";
    const target =
      parts[4] && parts[4].trim()
        ? parseFloat(parts[4]) || undefined
        : known?.targetAmountArs;
    const priority =
      parts[5] && parts[5].trim()
        ? parseInt(parts[5], 10) || undefined
        : known?.priority;

    return {
      pocket: {
        id: pocketId,
        name,
        icon,
        color,
        targetAmountArs: target,
        priority,
      },
      cleanNotes,
    };
  }

  // 2. Si solo venía el identificador simple (ej: [BOLSA:fondo-emergencia])
  if (known) {
    return { pocket: known, cleanNotes };
  }

  // 3. Fallback con el ID legible
  return {
    pocket: {
      id: pocketId,
      name: pocketId.charAt(0).toUpperCase() + pocketId.slice(1).replace(/-/g, " "),
      icon: "💰",
      color: "indigo",
    },
    cleanNotes,
  };
}

/**
 * Inserta o reemplaza el tag [BOLSA:...] en las notas de una inversión.
 */
export function injectPocketIntoNotes(
  notes: string | null | undefined,
  pocket: InvestmentPocket
): string {
  const clean = notes ? notes.replace(POCKET_TAG_REGEX, "").trim() : "";
  const isDefault = DEFAULT_POCKETS.some(
    (p) =>
      p.id === pocket.id &&
      p.name === pocket.name &&
      p.icon === pocket.icon &&
      p.color === pocket.color &&
      !pocket.targetAmountArs &&
      (pocket.priority === undefined || pocket.priority === p.priority)
  );

  let tag = `[BOLSA:${pocket.id}]`;
  if (!isDefault) {
    const targetStr = pocket.targetAmountArs ? String(pocket.targetAmountArs) : "";
    const priorityStr = pocket.priority !== undefined ? String(pocket.priority) : "";
    if (targetStr || priorityStr) {
      tag = `[BOLSA:${pocket.id}::${pocket.name}::${pocket.icon}::${pocket.color}::${targetStr}::${priorityStr}]`;
    } else {
      tag = `[BOLSA:${pocket.id}::${pocket.name}::${pocket.icon}::${pocket.color}]`;
    }
  }

  if (!clean) return tag;
  return `${tag} ${clean}`;
}

/**
 * Agrupa y consolida todas las bolsas presentes en las inversiones más las predeterminadas y personalizadas,
 * ordenadas según la prioridad asignada (Prioridad 1 primero).
 */
export function resolveAllPockets(
  investments: Array<{ notes?: string | null }>,
  customPockets: InvestmentPocket[] = []
): InvestmentPocket[] {
  const map = new Map<string, InvestmentPocket>();

  // 1. Cargar las predeterminadas iniciales
  for (const dp of DEFAULT_POCKETS) {
    map.set(dp.id, { ...dp });
  }

  // 2. Extraer configuración maestra de bolsas si alguna inversión tiene [POCKETS_DATA:...]
  for (const inv of investments) {
    if (inv.notes && POCKETS_DATA_REGEX.test(inv.notes)) {
      const masterList = extractMasterPocketsData(inv.notes);
      if (masterList && Array.isArray(masterList)) {
        for (const p of masterList) {
          if (p && p.id) {
            const existing = map.get(p.id);
            map.set(p.id, existing ? { ...existing, ...p } : { ...p });
          }
        }
      }
    }
  }

  // 3. Cargar las personalizadas del usuario en este navegador (localStorage)
  for (const cp of customPockets) {
    const existing = map.get(cp.id);
    map.set(cp.id, existing ? { ...existing, ...cp } : { ...cp });
  }

  // 4. Inspeccionar las notas individuales [BOLSA:...] de cada inversión
  for (const inv of investments) {
    if (inv.notes && POCKET_TAG_REGEX.test(inv.notes)) {
      const { pocket } = extractPocketFromNotes(inv.notes, Array.from(map.values()));
      const existing = map.get(pocket.id);
      map.set(pocket.id, existing ? { ...existing, ...pocket } : pocket);
    }
  }

  // Ordenar por prioridad ascendente (1, 2, 3...)
  return Array.from(map.values()).sort((a, b) => {
    const pA = typeof a.priority === "number" ? a.priority : 999;
    const pB = typeof b.priority === "number" ? b.priority : 999;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name, "es");
  });
}
