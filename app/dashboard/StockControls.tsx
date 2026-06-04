"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type InventoryItem = {
  id: number;
  product_name: string;
  sponsor: string;
  category: string;
  quantity_received: number;
  quantity_remaining: number;
};

export default function StockControls({ items }: { items: InventoryItem[] }) {
  const [localItems, setLocalItems] = useState<InventoryItem[]>(items);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [stockChangeAmount, setStockChangeAmount] = useState("1");

  useEffect(() => {
    const channel = supabase
      .channel("inventory_item_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_item",
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updatedItem = payload.new as InventoryItem;

            setLocalItems((currentItems) =>
              currentItems.map((item) =>
                item.id === updatedItem.id ? updatedItem : item
              )
            );

            setSelectedItem((currentSelected) =>
              currentSelected?.id === updatedItem.id
                ? updatedItem
                : currentSelected
            );
          }

          if (payload.eventType === "INSERT") {
            const newItem = payload.new as InventoryItem;

            setLocalItems((currentItems) => {
              const exists = currentItems.some((item) => item.id === newItem.id);
              if (exists) return currentItems;

              return [...currentItems, newItem].sort((a, b) => a.id - b.id);
            });
          }

          if (payload.eventType === "DELETE") {
            const deletedItem = payload.old as InventoryItem;

            setLocalItems((currentItems) =>
              currentItems.filter((item) => item.id !== deletedItem.id)
            );

            setSelectedItem((currentSelected) =>
              currentSelected?.id === deletedItem.id ? null : currentSelected
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalProducts = localItems.length;

  const totalQuantityRemaining = localItems.reduce((sum, item) => {
    return sum + Number(item.quantity_remaining || 0);
  }, 0);

  const totalQuantityReceived = localItems.reduce((sum, item) => {
    return sum + Number(item.quantity_received || 0);
  }, 0);

  const lowStockItems = localItems.filter((item) => {
    const received = Number(item.quantity_received || 0);
    const remaining = Number(item.quantity_remaining || 0);

    if (received === 0) return false;

    return remaining < received * 0.5;
  });

  const filteredItems = localItems.filter((item) => {
    const search = searchText.toLowerCase();

    return (
      item.product_name.toLowerCase().includes(search) ||
      item.sponsor.toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search)
    );
  });

  async function updateStock(direction: "add" | "subtract") {
    if (!selectedItem) return;

    const amount = Number(stockChangeAmount);

    if (!amount || amount <= 0) {
      alert("Please enter a number bigger than 0");
      return;
    }

    const change = direction === "add" ? amount : -amount;

    setLoading(true);

    const { data, error } = await supabase.rpc("adjust_inventory_quantity", {
      item_id: selectedItem.id,
      change_amount: change,
    });

    if (error) {
      alert("Update failed: " + error.message);
      setLoading(false);
      return;
    }

    const updatedItem = data as InventoryItem;

    setSelectedItem(updatedItem);

    setLocalItems((currentItems) =>
      currentItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      )
    );

    setLoading(false);
  }

  return (
    <main style={pageStyle}>
      <section style={topHeaderStyle}>
        <p style={smallTextStyle}>Supabase Dashboard</p>
        <h1 style={titleStyle}>Event Inventory</h1>
        <p style={subtitleStyle}>
          Track sponsored products, stock received, and remaining inventory.
        </p>
      </section>

      <section style={cardsGridStyle}>
        <DashboardCard
          label="Total Products"
          value={totalProducts}
          description="Items in inventory"
        />

        <DashboardCard
          label="Current Quantity"
          value={totalQuantityRemaining}
          description="Stock remaining"
        />

        <DashboardCard
          label="Total Received"
          value={totalQuantityReceived}
          description="Initial stock received"
        />

        <DashboardCard
          label="Low Stock Items"
          value={lowStockItems.length}
          description="Items below 50% remaining"
        />
      </section>

      <section style={tableSectionStyle}>
        <div style={tableTopStyle}>
          <div>
            <h2 style={sectionTitleStyle}>Inventory Items</h2>
            <p style={sectionSubtitleStyle}>
              Search an item, click it, then type a number and use + or -.
            </p>
          </div>

          <div style={searchBoxStyle}>
            <span style={searchIconTextStyle}>⌕</span>
            <input
              type="text"
              placeholder="Search product, sponsor, or category..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={searchInputStyle}
            />
          </div>
        </div>

        {searchText && (
          <p style={searchResultStyle}>
            Showing {filteredItems.length} result(s) for "{searchText}"
          </p>
        )}

        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product Name</th>
                <th style={thStyle}>Sponsor</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Received</th>
                <th style={thStyle}>Remaining</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => {
                const received = Number(item.quantity_received || 0);
                const remaining = Number(item.quantity_remaining || 0);

                let status = "Good";
                let badgeBackground = "#dcfce7";
                let badgeColor = "#166534";

                if (received > 0 && remaining < received * 0.5) {
                  status = "Low Stock";
                  badgeBackground = "#fee2e2";
                  badgeColor = "#991b1b";
                } else if (received > 0 && remaining < received) {
                  status = "Medium";
                  badgeBackground = "#fef3c7";
                  badgeColor = "#92400e";
                }

                const isSelected = selectedItem?.id === item.id;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                    }}
                  >
                    <td style={tdStrongStyle}>{item.product_name}</td>
                    <td style={tdStyle}>{item.sponsor}</td>
                    <td style={tdStyle}>{item.category}</td>
                    <td style={tdStyle}>{item.quantity_received}</td>
                    <td style={tdStyle}>{item.quantity_remaining}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...badgeStyle,
                          backgroundColor: badgeBackground,
                          color: badgeColor,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={emptyStyle}>
                    No item found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedItem && (
        <div style={bottomBarStyle}>
          <div>
            <p style={selectedLabelStyle}>Selected Item</p>
            <h3 style={selectedNameStyle}>{selectedItem.product_name}</h3>
            <p style={selectedInfoStyle}>
              Remaining: {selectedItem.quantity_remaining} / Received:{" "}
              {selectedItem.quantity_received}
            </p>
          </div>

          <div style={buttonGroupStyle}>
            <button
              onClick={() => updateStock("subtract")}
              disabled={loading}
              style={minusButtonStyle}
            >
              -
            </button>

            <input
              type="number"
              min="1"
              value={stockChangeAmount}
              onChange={(event) => setStockChangeAmount(event.target.value)}
              style={stockInputStyle}
            />

            <button
              onClick={() => updateStock("add")}
              disabled={loading}
              style={plusButtonStyle}
            >
              +
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function DashboardCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div style={cardStyle}>
      <p style={cardLabelStyle}>{label}</p>
      <h2 style={cardValueStyle}>{value}</h2>
      <p style={cardDescriptionStyle}>{description}</p>
    </div>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "35px",
  paddingBottom: "150px",
  fontFamily: "Arial, sans-serif",
  backgroundColor: "#f4f6f8",
  color: "#111827",
};

const topHeaderStyle = {
  backgroundColor: "#252a38",
  color: "white",
  padding: "32px",
  marginBottom: "28px",
};

const smallTextStyle = {
  margin: 0,
  color: "#5b7cfa",
  fontSize: "14px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "2px",
};

const titleStyle = {
  margin: "10px 0",
  fontSize: "38px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
};

const subtitleStyle = {
  margin: 0,
  color: "#e5e7eb",
  fontSize: "17px",
  fontWeight: "bold",
};

const cardsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "20px",
  marginBottom: "28px",
};

const cardStyle = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.06)",
  border: "1px solid #e5e7eb",
};

const cardLabelStyle = {
  margin: 0,
  fontSize: "14px",
  color: "#6b7280",
};

const cardValueStyle = {
  margin: "14px 0 8px",
  fontSize: "34px",
  color: "#111827",
};

const cardDescriptionStyle = {
  margin: 0,
  fontSize: "13px",
  color: "#9ca3af",
};

const tableSectionStyle = {
  backgroundColor: "#ffffff",
  padding: "24px",
  borderRadius: "14px",
  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.06)",
  border: "1px solid #e5e7eb",
};

const tableTopStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  gap: "20px",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "24px",
  color: "#111827",
};

const sectionSubtitleStyle = {
  margin: "8px 0 0",
  color: "#6b7280",
  fontSize: "14px",
};

const searchBoxStyle = {
  width: "420px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "999px",
  padding: "12px 18px",
};

const searchIconTextStyle = {
  fontSize: "22px",
  color: "#6b7280",
};

const searchInputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  backgroundColor: "transparent",
  fontSize: "14px",
  color: "#111827",
};

const searchResultStyle = {
  margin: "0 0 15px",
  color: "#2563eb",
  fontSize: "14px",
  fontWeight: "bold",
};

const tableWrapperStyle = {
  overflowX: "auto" as const,
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
};

const thStyle = {
  textAlign: "left" as const,
  padding: "14px",
  backgroundColor: "#f9fafb",
  color: "#374151",
  fontSize: "14px",
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle = {
  padding: "14px",
  fontSize: "14px",
  color: "#374151",
};

const tdStrongStyle = {
  padding: "14px",
  fontSize: "14px",
  fontWeight: "bold",
  color: "#111827",
};

const badgeStyle = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: "bold",
};

const emptyStyle = {
  padding: "30px",
  textAlign: "center" as const,
  color: "#6b7280",
};

const bottomBarStyle = {
  position: "fixed" as const,
  left: "40px",
  right: "40px",
  bottom: "20px",
  backgroundColor: "#111827",
  color: "white",
  padding: "22px 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 -8px 20px rgba(0, 0, 0, 0.25)",
  zIndex: 50,
  borderRadius: "18px",
};

const selectedLabelStyle = {
  margin: 0,
  fontSize: "12px",
  color: "#9ca3af",
  textTransform: "uppercase" as const,
  letterSpacing: "1px",
};

const selectedNameStyle = {
  margin: "6px 0",
  fontSize: "20px",
};

const selectedInfoStyle = {
  margin: 0,
  color: "#d1d5db",
};

const buttonGroupStyle = {
  display: "flex",
  gap: "16px",
  alignItems: "center",
};

const stockInputStyle = {
  width: "110px",
  height: "60px",
  borderRadius: "18px",
  border: "1px solid #374151",
  backgroundColor: "#ffffff",
  color: "#111827",
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  outline: "none",
};

const minusButtonStyle = {
  width: "120px",
  height: "60px",
  borderRadius: "999px",
  border: "none",
  backgroundColor: "#ef4444",
  color: "white",
  fontSize: "30px",
  fontWeight: "bold",
  cursor: "pointer",
};

const plusButtonStyle = {
  width: "120px",
  height: "60px",
  borderRadius: "999px",
  border: "none",
  backgroundColor: "#2563eb",
  color: "white",
  fontSize: "30px",
  fontWeight: "bold",
  cursor: "pointer",
};