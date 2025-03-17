import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_stock: number;
}

interface StockPurchase {
  id: string;
  raw_material_id: string;
  quantity: number;
  date: string;
}

interface StockStatus {
  id: string;
  month: string;
  year: number;
  raw_material_id: string;
  raw_material_name: string;
  raw_material_category: string;
  raw_material_unit: string;
  opening_balance: number;
  purchases: number;
  utilized: number;
  adjustment: number;
  closing_balance: number;
  min_level: number;
}

const StockStatusPage = () => {
  const [stockStatus, setStockStatus] = useState<StockStatus[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Parse date to get month and year
  const month = new Date(statusDate).toLocaleString('default', { month: 'short' });
  const year = new Date(statusDate).getFullYear();

  // Fetch data on component mount
  useEffect(() => {
    fetchRawMaterials();
    fetchStockPurchases();
  }, []);

  useEffect(() => {
    if (rawMaterials.length > 0 && stockPurchases.length > 0) {
      fetchStockStatus();
    }
  }, [rawMaterials, stockPurchases, statusDate]);

  const fetchRawMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');

      if (error) throw error;
      setRawMaterials(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching raw materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStockPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setStockPurchases(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching stock purchases",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      
      // Create or update stock status for each raw material
      const stockStatusItems: StockStatus[] = [];
      const newAdjustments: Record<string, number> = {};
      const newOpeningBalances: Record<string, number> = {};

      for (const material of rawMaterials) {
        // Generate a unique ID for this combination
        const comboId = `${material.id}_${month}_${year}`;
        
        // Check if we already have data for this combination
        const { data: existingData, error: existingError } = await supabase
          .from('stock_status')
          .select('*')
          .eq('month', month)
          .eq('year', year)
          .eq('raw_material_id', material.id)
          .maybeSingle();

        if (existingError) {
          console.error("Error fetching existing stock status:", existingError);
        }

        // Reset opening balance to zero
        const opening_balance = 0;

        // Calculate the total purchases for this material in the current month
        const totalPurchases = stockPurchases
          .filter(purchase => 
            purchase.raw_material_id === material.id && 
            new Date(purchase.date).getMonth() === new Date(statusDate).getMonth() && 
            new Date(purchase.date).getFullYear() === new Date(statusDate).getFullYear()
          )
          .reduce((sum, purchase) => sum + purchase.quantity, 0);

        // Calculate the utilized quantity for this material in the current month (using appropriate logic)
        const utilizedQuantity = 0; // Placeholder for utilized quantity logic

        // Calculate the closing balance
        const closing_balance = opening_balance + totalPurchases - utilizedQuantity + (existingData?.adjustment || 0);

        stockStatusItems.push({
          id: existingData?.id || comboId, // Use existing ID if available, otherwise use comboId
          month,
          year,
          raw_material_id: material.id,
          raw_material_name: material.name,
          raw_material_category: material.category,
          raw_material_unit: material.unit,
          opening_balance,
          purchases: totalPurchases,
          utilized: utilizedQuantity,
          adjustment: existingData?.adjustment || 0,
          closing_balance,
          min_level: material.min_stock,
        });

        newOpeningBalances[comboId] = opening_balance;
      }

      setStockStatus(stockStatusItems);
      setAdjustments(newAdjustments);
      setOpeningBalances(newOpeningBalances);
    } catch (error: any) {
      toast({
        title: "Error fetching stock status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle adjustment change
  const handleAdjustmentChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAdjustments(prev => ({
      ...prev,
      [id]: numValue
    }));
  };

  // Handle opening balance change
  const handleOpeningBalanceChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setOpeningBalances(prev => ({
      ...prev,
      [id]: numValue
    }));
  };

  // Update stock status with new adjustments and opening balances
  const handleUpdateStatus = async () => {
    try {
      setLoading(true);

      for (const status of stockStatus) {
        const newAdjustment = adjustments[status.id] || 0;
        const newOpeningBalance = openingBalances[status.id] || status.opening_balance;
        const newClosingBalance = newOpeningBalance + status.purchases - status.utilized + newAdjustment;

        const { error } = await supabase
          .from('stock_status')
          .upsert({
            id: status.id, // Ensure the ID is correctly used for upsert
            month: status.month,
            year: status.year,
            raw_material_id: status.raw_material_id,
            opening_balance: newOpeningBalance,
            purchases: status.purchases,
            utilized: status.utilized,
            adjustment: newAdjustment,
            closing_balance: newClosingBalance,
            min_level: status.min_level
          });

        if (error) throw error;
      }

      toast({
        title: "Stock status updated",
        description: "Stock status has been updated successfully with new adjustments and opening balances.",
      });

      // Refresh data
      fetchStockStatus();
    } catch (error: any) {
      toast({
        title: "Error updating stock status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter stock status based on search query
  const filteredStockStatus = stockStatus.filter(status =>
    status.raw_material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.raw_material_category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Stock Status</h1>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="statusDate" className="block mb-1">Status Date</Label>
              <Input
                id="statusDate"
                type="date"
                value={statusDate}
                onChange={(e) => setStatusDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="search" className="block mb-1">Search</Label>
              <Input
                id="search"
                type="search"
                placeholder="Search stock status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RM/Stock Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Utilized</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Closing Balance</TableHead>
                  <TableHead>Min Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">Loading...</TableCell>
                  </TableRow>
                ) : filteredStockStatus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">No stock status found</TableCell>
                  </TableRow>
                ) : (
                  filteredStockStatus.map(status => (
                    <TableRow key={status.id}>
                      <TableCell>{status.raw_material_name}</TableCell>
                      <TableCell>{status.raw_material_category}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={openingBalances[status.id] || status.opening_balance.toString()}
                          onChange={(e) => handleOpeningBalanceChange(status.id, e.target.value)}
                          className="w-24"
                          min="0"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>{status.purchases.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.utilized.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={adjustments[status.id] || ''}
                          onChange={(e) => handleAdjustmentChange(status.id, e.target.value)}
                          className="w-24"
                          min="-9999"
                          step="0.01"
                        />
                      </TableCell>
                      <TableCell>{status.closing_balance.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.min_level.toFixed(2)} {status.raw_material_unit}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-end mt-4">
          <Button
            onClick={handleUpdateStatus}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Update Status
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default StockStatusPage;
