import { prisma } from "./prisma";

export async function ensureDefaultHousehold() {
  const existingHousehold = await prisma.household.findFirst({
    include: {
      users: true,
      categories: true,
      investments: true,
    },
  });

  if (existingHousehold) {
    return existingHousehold;
  }

  // Creamos el hogar por defecto
  const household = await prisma.household.create({
    data: {
      name: "Finanzas Hogar",
      currency: "ARS",
      defaultRate: 0.60,
      users: {
        create: [
          {
            name: "Augusto",
            email: "augusto@hogar.local",
            avatarColor: "#2563eb",
          },
          {
            name: "Agus",
            email: "agus@hogar.local",
            avatarColor: "#ec4899",
          },
        ],
      },
      categories: {
        create: [
          { name: "Supermercado", icon: "ShoppingCart", color: "#10b981" },
          { name: "Alquiler & Expensas", icon: "Home", color: "#3b82f6" },
          { name: "Servicios (Luz, Gas, Wifi)", icon: "Zap", color: "#f59e0b" },
          { name: "Salidas & Delivery", icon: "Utensils", color: "#ec4899" },
          { name: "Farmacia & Salud", icon: "HeartPulse", color: "#ef4444" },
          { name: "Transporte & Combustible", icon: "Car", color: "#8b5cf6" },
          { name: "Hogar & Arreglos", icon: "Wrench", color: "#06b6d4" },
          { name: "Varios", icon: "Tag", color: "#64748b" },
        ],
      },
      investments: {
        create: [
          {
            name: "FCI Ahorro Conjunto",
            currentValue: 0,
          },
        ],
      },
    },
    include: {
      users: true,
      categories: true,
      investments: true,
    },
  });

  // Creamos el período actual
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  await prisma.monthlyPeriod.create({
    data: {
      year,
      month,
      householdId: household.id,
      incomes: {
        create: household.users.map((u) => ({
          userId: u.id,
          amount: 0, // Se declarará en la UI
          contributionPct: 0.60,
          targetPoolAmount: 0,
        })),
      },
    },
  });

  return household;
}
