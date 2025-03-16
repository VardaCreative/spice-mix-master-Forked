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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Process {
  id: string;
  name: string;
  type: 'pre-production' | 'production';
}

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
  stock_name: string;
  quantity: number;
  date: string;
}

interface ProductionStatus {
  id: string;
  month: string;
  year: number;
  process: string;
  raw_material_id: string;
  raw_material_name: string;
  raw_material_category: string;
  raw_material_unit: string;
  opening_balance: number;
  assigned: number;
  completed: number;
  wastage: number;
  pending: number;
  adjustment: number;
  closing_balance: number;
  min_level: number;
}

const ProductionStatusPage = () => {
  const [productionStatus, setProductionStatus] = useState<ProductionStatus[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProcess, setSelectedProcess] = useState<string>('all');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const { toast } = useToast();

  // Parse date to get month and year
  const month = new Date(statusDate).toLocaleString('default', { month: 'short' });
  const year = new Date(statusDate).getFullYear();

  // Fetch data on component mount
  useEffect(() => {
    fetchProcesses();
    fetchRawMaterials();
    fetchStockPurchases();
  }, []);

  useEffect(() => {
    if (processes.length > 0 && rawMaterials.length > 0 && stockPurchases.length > 0) {
      fetchProductionStatus();
    }
  }, [processes, rawMaterials, stockPurchases, statusDate, selectedProcess]);

  const fetchProcesses = async () => {
    try {
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .order('name');

      if (error) throw error;
      setProcesses(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching processes",
        description: error.message,
        variant: "destructive",
      });
    }
  };

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

  const fetchProductionStatus = async () => {
    try {
      setLoading(true);
      
      // Create or update production status for each process and material combination
      const productionStatusItems: ProductionStatus[] = [];
      const newAdjustments: Record<string, number> = {};

      // For each raw material and process combination
      for (const material of rawMaterials) {
        // Filter processes if a specific one is selected
        const processesToUse = selectedProcess === 'all' 
          ? processes 
          : processes.filter(p => p.name === selectedProcess);

        for (const process of processesToUse) {
          // Generate a unique ID for this combination
          const comboId = `${material.id}_${process.name}_${month}_${year}`;
          
          // Check if we already have data for this combination
          const { data: existingData, error: existingError } = await supabase
            .from('production_status')
            .select('*')
            .eq('month', month)
            .eq('year', year)
            .eq('raw_material_id', material.id)
            .eq('process', process.name)
            .maybeSingle();

          if (existingError) {
            console.error("Error fetching existing production status:", existingError);
          }

          // Get previous month's closing balance
          const prevMonth = new Date(year, new Date(`${month} 1, ${year}`).getMonth() - 1, 1);
          const prevMonthString = prevMonth.toLocaleString('default', { month: 'short' });
          const prevYear = prevMonth.getFullYear();
          
          const { data: prevData, error: prevError } = await supabase
            .from('production_status')
            .select('closing_balance')
            .eq('month', prevMonthString)
            .eq('year', prevYear)
            .eq('raw_material_id', material.id)
            .eq('process', process.name)
            .maybeSingle();

          if (prevError) {
            console.error("Error fetching previous production status:", prevError);
          }

          const opening_balance = prevData ? prevData.closing_balance : 0;

          // Calculate the total purchases for this material in the current month
          const totalPurchases = stockPurchases
            .filter(purchase => 
              purchase.stock_name === material.name && 
              new Date(purchase.date).getMonth() === new Date(statusDate).getMonth() && 
              new Date(purchase.date).getFullYear() === new Date(statusDate).getFullYear()
            )
            .reduce((sum, purchase) => sum + purchase.quantity, 0);

          // Calculate the closing balance
          const closing_balance = opening_balance + totalPurchases - (existingData?.assigned || 0) - (existingData?.completed || 0) - (existingData?.wastage || 0);

          productionStatusItems.push({
            id: comboId,
            month,
            year,
            process: process.name,
            raw_material_id: material.id,
            raw_material_name: material.name,
            raw_material_category: material.category,
            raw_material_unit: material.unit,
            opening_balance,
            assigned: existingData?.assigned || 0,
            completed: existingData?.completed || 0,
            wastage: existingData?.wastage || 0,
            pending: existingData?.pending || 0,
            adjustment: existingData?.adjustment || 0,
            closing_balance,
            min_level: material.min_stock,
          });
        }
      }

      setProductionStatus(productionStatusItems);
      setAdjustments(newAdjustments);
    } catch (error: any) {
      toast({
        title: "Error fetching production status",
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

  // Update production status with new adjustments
  const handleUpdateStatus = async () => {
    try {
      setLoading(true);

      for (const status of productionStatus) {
        const newAdjustment = adjustments[status.id] || 0;
        const newClosingBalance = status.closing_balance + newAdjustment;

        const { error } = await supabase
          .from('production_status')
          .update({
            adjustment: newAdjustment,
            closing_balance: newClosingBalance,
          })
          .eq('id', status.id);

        if (error) throw error;
      }

      toast({
        title: "Production status updated",
        description: "Production status has been updated successfully with new adjustments.",
      });

      // Refresh data
      fetchProductionStatus();
    } catch (error: any) {
      toast({
        title: "Error updating production status",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter production status based on search query
  const filteredProductionStatus = productionStatus.filter(status =>
    status.raw_material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.raw_material_category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    status.process.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Production Status</h1>
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
              <Label htmlFor="processFilter" className="block mb-1">Process</Label>
              <Select value={selectedProcess} onValueChange={setSelectedProcess}>
                <SelectTrigger id="processFilter" className="w-40">
                  <SelectValue placeholder="Select Process" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Processes</SelectItem>
                  {processes.map(process => (
                    <SelectItem key={process.id} value={process.name}>
                      {process.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="search" className="block mb-1">Search</Label>
              <Input
                id="search"
                type="search"
                placeholder="Search production status..."
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
                  <TableHead>Process</TableHead>
                  <TableHead>RM/Stock Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Wastage</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Closing Balance</TableHead>
                  <TableHead>Min Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-4">Loading...</TableCell>
                  </TableRow>
                ) : filteredProductionStatus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-4">No production status found</TableCell>
                  </TableRow>
                ) : (
                  filteredProductionStatus.map(status => (
                    <TableRow key={status.id}>
                      <TableCell>{status.process}</TableCell>
                      <TableCell>{status.raw_material_name}</TableCell>
                      <TableCell>{status.raw_material_category}</TableCell>
                      <TableCell>{status.opening_balance.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.assigned.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.completed.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.wastage.toFixed(2)} {status.raw_material_unit}</TableCell>
                      <TableCell>{status.pending.toFixed(2)} {status.raw_material_unit}</TableCell>
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

export default ProductionStatusPage;
