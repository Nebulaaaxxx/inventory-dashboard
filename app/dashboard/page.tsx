import { supabase } from "@/lib/supabaseClient";
import StockControls from "./StockControls";

export default async function DashboardPage() {
  const { data, error } = await supabase
    .from("inventory_item")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: "40px", fontFamily: "Arial" }}>
        <h1>Dashboard Error</h1>
        <p>{error.message}</p>
      </main>
    );
  }

  return <StockControls items={data || []} />;
}