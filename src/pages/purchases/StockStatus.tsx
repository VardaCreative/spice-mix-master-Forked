import { useState, useEffect } from "react";
import { supabase } from "../supabase";

const StockStatus = () => {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    fetchStockStatus();
  }, []);

  const fetchStockStatus = async () => {
    const { data, error } = await supabase
      .from("stock_status")
      .select("id, stock_name, opening_balance, purchases, utilised, adjustments");

    if (error) {
      console.error("Error fetching stock status:", error);
      return;
    }

    // Calculate closing balance for each stock entry
    const updatedStocks = data.map((stock) => ({
      ...stock,
      closing_balance: stock.opening_balance + stock.purchases - stock.utilised + stock.adjustments,
    }));

    setStocks(updatedStocks);
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Stock Status</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Stock Name</th>
            <th className="border p-2">Opening Balance</th>
            <th className="border p-2">Purchases</th>
            <th className="border p-2">Utilised</th>
            <th className="border p-2">Adjustments</th>
            <th className="border p-2">Closing Balance</th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((stock) => (
            <tr key={stock.id} className="text-center">
              <td className="border p-2">{stock.stock_name}</td>
              <td className="border p-2">{stock.opening_balance}</td>
              <td className="border p-2">{stock.purchases}</td>
              <td className="border p-2">{stock.utilised}</td>
              <td className="border p-2">{stock.adjustments}</td>
              <td className="border p-2 font-bold">{stock.closing_balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockStatus;
