import { BadgePercent, Droplet, Baby, CupSoda, Drumstick, IceCreamCone, Sandwich, Soup, UtensilsCrossed, Wheat, Utensils, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = { BadgePercent, Droplet, Baby, CupSoda, Drumstick, IceCreamCone, Sandwich, Soup, UtensilsCrossed, Wheat };
export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && MAP[name]) || Utensils;
  return <Icon className={className} />;
}
