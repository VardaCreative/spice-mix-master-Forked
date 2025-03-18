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
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Types
interface RawMaterial {
  id: string;
  name: string;
  category: string;
  min_stock: number;
  unit: string;
  current_stock: number;
}

interface StockStatus {
  id: string;
  month: string;
  year: number;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_category?: string;
  raw_material_unit?: string;
  opening_balance: number;
  purchases: number;
  utilized: number;
  adjustment: number;
  closing_balance: number;
  min_level: number;
  status: 'normal' | 'low' | 'out';
}

const StockStatusPage = () => {
  const [stockStatus, setStockStatus] = useState<StockStatus[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Parse date to get month and year
  const month = new Date(statusDate).toLocaleString('default', { month: 'short' });
  const year = new Date(statusDate).getFullYear();

  // Fetch data on component mount
  useEffect(() => {
    fetchRawMaterials();
  }, []);

  useEffect(() => {
    if (rawMaterials.length > 0) {
      fetchStockStatus();
    }
  }, [rawMaterials, statusDate]);

  // Fetch all raw materials
  const fetchRawMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      setRawMaterials(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching raw materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch stock status based on date
  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      const currentMonth = month;
      const currentYear = year;

      // Check if we have stock status records for this month/year
      const { data: existingData, error: existingError } = await supabase
        .from('stock_status')
        .select(`
          *,
          raw_materials(name, category, unit, min_stock)
        `)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (existingError) {
        throw existingError;
      }

      if (existingData && existingData.length > 0) {
        // We have records, process them
        const transformedData = existingData.map((status: any) => {
          const rawMaterial = status.raw_materials;
          return {
            ...status,
            raw_material_name: rawMaterial?.name || 'Unknown',
            raw_material_category: rawMaterial?.category || 'Unknown',
            raw_material_unit: rawMaterial?.unit || 'unit',
            min_level: rawMaterial?.min_stock || 0,
            status: determineStatus(status.closing_balance, rawMaterial?.min_stock || 0),
          };
        });

        setStockStatus(transformedData);
        
        // Initialize adjustments
        const newAdjustments: Record<string, number> = {};
        transformedData.forEach((status) => {
          newAdjustments[status.id] = status.adjustment;
        });
        setAdjustments(newAdjustments);
      } else {
        // No records for this month/year, we need to create them
        await generateStockStatus(currentMonth, currentYear);
      }
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

  // Generate stock status for a month
  const generateStockStatus = async (month: string, year: number) => {
    try {
      // For each raw material, we need to:
      // 1. Get previous month's closing balance (or current_stock if no previous record)
      // 2. Calculate purchases from stock_purchases in current month
      // 3. Calculate utilized from tasks in current month (only Cleaning process)
      // 4. Calculate closing balance = opening + purchases - utilized + adjustment
      const newStockStatus: StockStatus[] = [];
      const newAdjustments: Record<string, number> = {};

      for (const material of rawMaterials) {
        // Find previous month's record (for Opening Balance)
        // Get the previous month and year
        const currentDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
        const prevDate = new Date(currentDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevMonthString = prevDate.toLocaleString('default', { month: 'short' });
        const prevYear = prevDate.getFullYear();
        
        // Query previous month's closing balance
        const { data: prevData } = await supabase
          .from('stock_status')
          .select('closing_balance')
          .eq('month', prevMonthString)
          .eq('year', prevYear)
          .eq('raw_material_id', material.id)
          .maybeSingle();

        // Get opening balance - the closing balance of the previous month
        const openingBalance = prevData ? prevData.closing_balance : material.current_stock;

        // Calculate purchases for current month - sum of all purchases for this material in the month
        const startDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
        const endDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0);
        
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('stock_purchases')
          .select('quantity')
          .eq('raw_material_id', material.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (purchasesError) throw purchasesError;
        
        const purchases = purchasesData?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;

        // Calculate utilized for current month - sum of all cleaning process assignments for this material
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('assigned_qty')
          .eq('raw_material_id', material.id)
          .eq('process', 'Cleaning')  // Only count 'Cleaning' process as per requirements
          .gte('date_assigned', startDate.toISOString().split('T')[0])
          .lte('date_assigned', endDate.toISOString().split('T')[0]);

        if (tasksError) throw tasksError;
        
        const utilized = tasksData?.reduce((sum, item) => sum + Number(item.assigned_qty), 0) || 0;

        // Use adjustment of 0 initially
        const adjustment = 0;

        // Calculate closing balance = opening + purchases - utilized + adjustment
        const closingBalance = openingBalance + purchases - utilized + adjustment;

        // Determine status
        const status = determineStatus(closingBalance, material.min_stock);

        // Create new stock status record
        const newStatus: StockStatus = {
          id: `temp_${material.id}`,
          month,
          year,
          raw_material_id: material.id,
          raw_material_name: material.name,
          raw_material_category: material.category,
          raw_material_unit: material.unit,
          opening_balance: openingBalance,
          purchases,
          utilized,
          adjustment,
          closing_balance: closingBalance,
          min_level: material.min_stock,
          status,
        };

        newStockStatus.push(newStatus);
        newAdjustments[`temp_${material.id}`] = 0;

        // Insert into database
        const { data: insertedData, error: insertError } = await supabase
          .from('stock_status')
          .insert({
            month,
            year,
            raw_material_id: material.id,
            opening_balance: openingBalance,
            purchases,
            utilized,
            adjustment,
            closing_balance: closingBalance,
            status,
          })
          .select();

        if (insertError) throw insertError;

        if (insertedData && insertedData[0]) {
          // Update id in memory
          newStatus.id = insertedData[0].id;
          newAdjustments[insertedData[0].id] = 0;
          delete newAdjustments[`temp_${material.id}`];
        }
      }

      setStockStatus(newStockStatus);
      setAdjustments(newAdjustments);
    } catch (error: any) {
      toast({
        title: "Error generating stock status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Determine status based on closing balance and min stock
  const determineStatus = (closing: number, min: number): 'normal' | 'low' | 'out' => {
    if (closing <= 0) return 'out';
    if (closing < min) return 'low';
    return 'normal';
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
    setStockStatus(prev => prev.map(status => 
      status.id === id ? { ...status, opening_balance: numValue } : status
    ));
  };

  // Update stock status with new adjustments
  const handleUpdateStatus = async () => {
    try {
      setLoading(true);

      // Update each stock status with new adjustment
      for (const status of stockStatus) {
        const newAdjustment = adjustments[status.id] || 0;
        const newClosingBalance = status.opening_balance + status.purchases - status.utilized + newAdjustment;
        const newStatus = determineStatus(newClosingBalance, status.min_level);

        // Update in database
        const { error } = await supabase
          .from('stock_status')
          .update({
            adjustment: newAdjustment,
            closing_balance: newClosingBalance,
            status: newStatus
          })
          .eq('id', status.id);

        if (error) throw error;

        // Also update raw material current stock
        const { error: materialError } = await supabase
          .from('raw_materials')
          .update({
            current_stock: newClosingBalance
          })
          .eq('id', status.raw_material_id);

        if (materialError) throw materialError;
      }

      toast({
        title: "Stock status updated",
        description: "Stock status has been updated successfully with new adjustments.",
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

  // Get status counts
  const normalCount = stockStatus.filter(s => s.status === 'normal').length;
  const lowCount = stockStatus.filter(s => s.status === 'low').length;
  const outCount = stockStatus.filter(s => s.status === 'out').length;

  // Filter stock status based on search query
  const filteredStockStatus = stockStatus.filter(status => 
    status.raw_material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.raw_material_category?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Month / Year</span>
              <div className="h-10 px-3 py-2 border border-gray-200 rounded bg-gray-50">
                {month}-{year}
              </div>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-green-600">{normalCount}</div>
            <div className="text-gray-600">Normal Stock Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-amber-600">{lowCount}</div>
            <div className="text-gray-600">Low Stock Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-red-600">{outCount}</div>
            <div className="text-gray-600">Out of Stock Items</div>
          </div>
        </div>

        <div className="flex items-center w-full max-w-md mb-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search stock status..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Opening Balance</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Utilised</TableHead>
                <TableHead>Adj +/-</TableHead>
                <TableHead>Closing Bal</TableHead>
                <TableHead>Min. Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">Loading...</TableCell>
                </TableRow>
              ) : stockStatus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    {searchQuery ? 'No stock items found matching your search.' : 'No stock status data available.'}
                  </TableCell>
                </TableRow>
              ) : (
                stockStatus
                  .filter(status => 
                    status.raw_material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    status.raw_material_category?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(status => {
                    // Calculate real-time closing balance based on current adjustment
                    const currentAdjustment = adjustments[status.id] || 0;
                    const calculatedClosingBalance = status.opening_balance + status.purchases - status.utilized + currentAdjustment;
                    const calculatedStatus = determineStatus(calculatedClosingBalance, status.min_level);
                    
                    return (
                      <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.raw_material_name}</TableCell>
                        <TableCell>{status.raw_material_category}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={status.opening_balance}
                            onChange={(e) => handleOpeningBalanceChange(status.id, e.target.value)}
                            className="w-16 text-center"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>{status.purchases} {status.raw_material_unit}</TableCell>
                        <TableCell>{status.utilized} {status.raw_material_unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={adjustments[status.id] || 0}
                            onChange={(e) => handleAdjustmentChange(status.id, e.target.value)}
                            className="w-16 text-center"
                            min="-9999"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>{calculatedClosingBalance.toFixed(2)} {status.raw_material_unit}</TableCell>
                        <TableCell>{status.min_level} {status.raw_material_unit}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            calculatedStatus === 'normal' ? 'bg-green-100 text-green-800' :
                            calculatedStatus === 'low' ? 'bg-amber-100 text-amber-800'// filepath: d:\TECH\IAMS\COPILOT\spice-mix-master-Forked\src\pages\purchases\StockStatus.tsx
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
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Types
interface RawMaterial {
  id: string;
  name: string;
  category: string;
  min_stock: number;
  unit: string;
  current_stock: number;
}

interface StockStatus {
  id: string;
  month: string;
  year: number;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_category?: string;
  raw_material_unit?: string;
  opening_balance: number;
  purchases: number;
  utilized: number;
  adjustment: number;
  closing_balance: number;
  min_level: number;
  status: 'normal' | 'low' | 'out';
}

const StockStatusPage = () => {
  const [stockStatus, setStockStatus] = useState<StockStatus[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Parse date to get month and year
  const month = new Date(statusDate).toLocaleString('default', { month: 'short' });
  const year = new Date(statusDate).getFullYear();

  // Fetch data on component mount
  useEffect(() => {
    fetchRawMaterials();
  }, []);

  useEffect(() => {
    if (rawMaterials.length > 0) {
      fetchStockStatus();
    }
  }, [rawMaterials, statusDate]);

  // Fetch all raw materials
  const fetchRawMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      setRawMaterials(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching raw materials",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch stock status based on date
  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      const currentMonth = month;
      const currentYear = year;

      // Check if we have stock status records for this month/year
      const { data: existingData, error: existingError } = await supabase
        .from('stock_status')
        .select(`
          *,
          raw_materials(name, category, unit, min_stock)
        `)
        .eq('month', currentMonth)
        .eq('year', currentYear);

      if (existingError) {
        throw existingError;
      }

      if (existingData && existingData.length > 0) {
        // We have records, process them
        const transformedData = existingData.map((status: any) => {
          const rawMaterial = status.raw_materials;
          return {
            ...status,
            raw_material_name: rawMaterial?.name || 'Unknown',
            raw_material_category: rawMaterial?.category || 'Unknown',
            raw_material_unit: rawMaterial?.unit || 'unit',
            min_level: rawMaterial?.min_stock || 0,
            status: determineStatus(status.closing_balance, rawMaterial?.min_stock || 0),
          };
        });

        setStockStatus(transformedData);
        
        // Initialize adjustments
        const newAdjustments: Record<string, number> = {};
        transformedData.forEach((status) => {
          newAdjustments[status.id] = status.adjustment;
        });
        setAdjustments(newAdjustments);
      } else {
        // No records for this month/year, we need to create them
        await generateStockStatus(currentMonth, currentYear);
      }
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

  // Generate stock status for a month
  const generateStockStatus = async (month: string, year: number) => {
    try {
      // For each raw material, we need to:
      // 1. Get previous month's closing balance (or current_stock if no previous record)
      // 2. Calculate purchases from stock_purchases in current month
      // 3. Calculate utilized from tasks in current month (only Cleaning process)
      // 4. Calculate closing balance = opening + purchases - utilized + adjustment
      const newStockStatus: StockStatus[] = [];
      const newAdjustments: Record<string, number> = {};

      for (const material of rawMaterials) {
        // Find previous month's record (for Opening Balance)
        // Get the previous month and year
        const currentDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
        const prevDate = new Date(currentDate);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevMonthString = prevDate.toLocaleString('default', { month: 'short' });
        const prevYear = prevDate.getFullYear();
        
        // Query previous month's closing balance
        const { data: prevData } = await supabase
          .from('stock_status')
          .select('closing_balance')
          .eq('month', prevMonthString)
          .eq('year', prevYear)
          .eq('raw_material_id', material.id)
          .maybeSingle();

        // Get opening balance - the closing balance of the previous month
        const openingBalance = prevData ? prevData.closing_balance : material.current_stock;

        // Calculate purchases for current month - sum of all purchases for this material in the month
        const startDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth(), 1);
        const endDate = new Date(year, new Date(`${month} 1, ${year}`).getMonth() + 1, 0);
        
        const { data: purchasesData, error: purchasesError } = await supabase
          .from('stock_purchases')
          .select('quantity')
          .eq('raw_material_id', material.id)
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (purchasesError) throw purchasesError;
        
        const purchases = purchasesData?.reduce((sum, item) => sum + Number(item.quantity), 0) || 0;

        // Calculate utilized for current month - sum of all cleaning process assignments for this material
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('assigned_qty')
          .eq('raw_material_id', material.id)
          .eq('process', 'Cleaning')  // Only count 'Cleaning' process as per requirements
          .gte('date_assigned', startDate.toISOString().split('T')[0])
          .lte('date_assigned', endDate.toISOString().split('T')[0]);

        if (tasksError) throw tasksError;
        
        const utilized = tasksData?.reduce((sum, item) => sum + Number(item.assigned_qty), 0) || 0;

        // Use adjustment of 0 initially
        const adjustment = 0;

        // Calculate closing balance = opening + purchases - utilized + adjustment
        const closingBalance = openingBalance + purchases - utilized + adjustment;

        // Determine status
        const status = determineStatus(closingBalance, material.min_stock);

        // Create new stock status record
        const newStatus: StockStatus = {
          id: `temp_${material.id}`,
          month,
          year,
          raw_material_id: material.id,
          raw_material_name: material.name,
          raw_material_category: material.category,
          raw_material_unit: material.unit,
          opening_balance: openingBalance,
          purchases,
          utilized,
          adjustment,
          closing_balance: closingBalance,
          min_level: material.min_stock,
          status,
        };

        newStockStatus.push(newStatus);
        newAdjustments[`temp_${material.id}`] = 0;

        // Insert into database
        const { data: insertedData, error: insertError } = await supabase
          .from('stock_status')
          .insert({
            month,
            year,
            raw_material_id: material.id,
            opening_balance: openingBalance,
            purchases,
            utilized,
            adjustment,
            closing_balance: closingBalance,
            status,
          })
          .select();

        if (insertError) throw insertError;

        if (insertedData && insertedData[0]) {
          // Update id in memory
          newStatus.id = insertedData[0].id;
          newAdjustments[insertedData[0].id] = 0;
          delete newAdjustments[`temp_${material.id}`];
        }
      }

      setStockStatus(newStockStatus);
      setAdjustments(newAdjustments);
    } catch (error: any) {
      toast({
        title: "Error generating stock status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Determine status based on closing balance and min stock
  const determineStatus = (closing: number, min: number): 'normal' | 'low' | 'out' => {
    if (closing <= 0) return 'out';
    if (closing < min) return 'low';
    return 'normal';
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
    setStockStatus(prev => prev.map(status => 
      status.id === id ? { ...status, opening_balance: numValue } : status
    ));
  };

  // Update stock status with new adjustments
  const handleUpdateStatus = async () => {
    try {
      setLoading(true);

      // Update each stock status with new adjustment
      for (const status of stockStatus) {
        const newAdjustment = adjustments[status.id] || 0;
        const newClosingBalance = status.opening_balance + status.purchases - status.utilized + newAdjustment;
        const newStatus = determineStatus(newClosingBalance, status.min_level);

        // Update in database
        const { error } = await supabase
          .from('stock_status')
          .update({
            adjustment: newAdjustment,
            closing_balance: newClosingBalance,
            status: newStatus
          })
          .eq('id', status.id);

        if (error) throw error;

        // Also update raw material current stock
        const { error: materialError } = await supabase
          .from('raw_materials')
          .update({
            current_stock: newClosingBalance
          })
          .eq('id', status.raw_material_id);

        if (materialError) throw materialError;
      }

      toast({
        title: "Stock status updated",
        description: "Stock status has been updated successfully with new adjustments.",
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

  // Get status counts
  const normalCount = stockStatus.filter(s => s.status === 'normal').length;
  const lowCount = stockStatus.filter(s => s.status === 'low').length;
  const outCount = stockStatus.filter(s => s.status === 'out').length;

  // Filter stock status based on search query
  const filteredStockStatus = stockStatus.filter(status => 
    status.raw_material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.raw_material_category?.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Month / Year</span>
              <div className="h-10 px-3 py-2 border border-gray-200 rounded bg-gray-50">
                {month}-{year}
              </div>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-green-600">{normalCount}</div>
            <div className="text-gray-600">Normal Stock Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-amber-600">{lowCount}</div>
            <div className="text-gray-600">Low Stock Items</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-xl font-bold text-red-600">{outCount}</div>
            <div className="text-gray-600">Out of Stock Items</div>
          </div>
        </div>

        <div className="flex items-center w-full max-w-md mb-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search stock status..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Opening Balance</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Utilised</TableHead>
                <TableHead>Adj +/-</TableHead>
                <TableHead>Closing Bal</TableHead>
                <TableHead>Min. Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">Loading...</TableCell>
                </TableRow>
              ) : stockStatus.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    {searchQuery ? 'No stock items found matching your search.' : 'No stock status data available.'}
                  </TableCell>
                </TableRow>
              ) : (
                stockStatus
                  .filter(status => 
                    status.raw_material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    status.raw_material_category?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(status => {
                    // Calculate real-time closing balance based on current adjustment
                    const currentAdjustment = adjustments[status.id] || 0;
                    const calculatedClosingBalance = status.opening_balance + status.purchases - status.utilized + currentAdjustment;
                    const calculatedStatus = determineStatus(calculatedClosingBalance, status.min_level);
                    
                    return (
                      <TableRow key={status.id}>
                        <TableCell className="font-medium">{status.raw_material_name}</TableCell>
                        <TableCell>{status.raw_material_category}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={status.opening_balance}
                            onChange={(e) => handleOpeningBalanceChange(status.id, e.target.value)}
                            className="w-16 text-center"
                            min="0"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>{status.purchases} {status.raw_material_unit}</TableCell>
                        <TableCell>{status.utilized} {status.raw_material_unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={adjustments[status.id] || 0}
                            onChange={(e) => handleAdjustmentChange(status.id, e.target.value)}
                            className="w-16 text-center"
                            min="-9999"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>{calculatedClosingBalance.toFixed(2)} {status.raw_material_unit}</TableCell>
                        <TableCell>{status.min_level} {status.raw_material_unit}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            calculatedStatus === 'normal' ? 'bg-green-100 text-green-800' :
                            calculatedStatus === 'low' ? 'bg-amber-100 text-amber-800'
