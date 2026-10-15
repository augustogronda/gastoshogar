import React from "react";
import {
  ShoppingCart,
  Home,
  Zap,
  Utensils,
  HeartPulse,
  Car,
  Wrench,
  Tag,
  Package,
  Wallet,
  TrendingUp,
  PiggyBank,
  Plus,
  Check,
  Trash2,
  Calendar,
  Settings,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Percent,
  X,
  CreditCard,
  User,
  Users,
  BarChart3,
  PieChart,
  Repeat,
  Layers,
  AlertCircle,
  Receipt,
  Copy,
  Lock,
  Unlock,
} from "lucide-react";

export const CategoryIcon = ({
  name,
  className = "w-5 h-5",
}: {
  name?: string | null;
  className?: string;
}) => {
  switch (name?.toLowerCase()) {
    case "shoppingcart":
    case "supermercado":
      return <ShoppingCart className={className} />;
    case "home":
    case "alquiler & expensas":
    case "alquiler":
      return <Home className={className} />;
    case "zap":
    case "servicios (luz, gas, wifi)":
    case "servicios":
      return <Zap className={className} />;
    case "utensils":
    case "salidas & delivery":
    case "salidas":
      return <Utensils className={className} />;
    case "heartpulse":
    case "farmacia & salud":
    case "farmacia":
      return <HeartPulse className={className} />;
    case "car":
    case "transporte & combustible":
    case "transporte":
      return <Car className={className} />;
    case "wrench":
    case "hogar & arreglos":
    case "mantenimiento":
      return <Wrench className={className} />;
    default:
      return <Tag className={className} />;
  }
};

export {
  ShoppingCart,
  Home,
  Zap,
  Utensils,
  HeartPulse,
  Car,
  Wrench,
  Tag,
  Package,
  Wallet,
  TrendingUp,
  PiggyBank,
  Plus,
  Check,
  Trash2,
  Calendar,
  Settings,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Percent,
  X,
  CreditCard,
  User,
  Users,
  BarChart3,
  PieChart,
  Repeat,
  Layers,
  AlertCircle,
  Receipt,
  Copy,
  Lock,
  Unlock,
};
