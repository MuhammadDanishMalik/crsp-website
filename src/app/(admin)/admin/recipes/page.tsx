import { requireSession } from "@/lib/auth/session";
import { loadRecipes, loadStock, loadUnits } from "@/lib/queries/inventory";
import { RecipeEditor } from "./recipe-editor";

export default async function RecipesPage() {
  const session = await requireSession({ permission: "inventory.view", kind: "admin" });
  const [items, stock, { units, conv }] = await Promise.all([loadRecipes(session.branchId), loadStock(session.branchId), loadUnits()]);
  return <RecipeEditor items={items} ingredients={stock.map((i) => ({ id: i.id, name: i.name, baseUnitId: i.baseUnitId, unitCode: i.unit, per: i.nutrition }))} units={units} conv={conv} canEdit={session.can("inventory.recipes")} />;
}
