import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supplierSupplies, type Supply } from "./data";

type Row = { id: string; supplier_id: string; name: string; name_ar: string; description: string; description_ar: string; type: Supply["type"]; price: number; stock: number; swatch: string;
  supplier_accounts: { name: string; name_ar: string; city: string; city_ar: string } | null };

export const SUPPLIER_PRODUCT_SELECT = "id,supplier_id,name,name_ar,description,description_ar,type,price,stock,swatch,supplier_accounts(name,name_ar,city,city_ar)";

export function rowToSupply(r: Row): Supply {
  const s = r.supplier_accounts;
  return { id: r.id, supplierId: r.supplier_id, name: r.name, nameAr: r.name_ar, description: r.description, descriptionAr: r.description_ar || r.description,
    type: r.type, price: Number(r.price), stock: r.stock, swatch: r.swatch, maker: s?.name ?? "", makerAr: s?.name_ar || s?.name || "", city: s?.city ?? "", cityAr: s?.city_ar || s?.city || "" };
}

/** Published supplier products; also registers them so the basket and checkout can price them. */
export function useSupplierProducts() {
  return useQuery({
    queryKey: ["supplier-products-public"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("supplier_products").select(SUPPLIER_PRODUCT_SELECT).eq("status", "published").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const list = ((data ?? []) as Row[]).map(rowToSupply);
      supplierSupplies.splice(0, supplierSupplies.length, ...list);
      return list;
    },
    staleTime: 60_000,
  });
}
