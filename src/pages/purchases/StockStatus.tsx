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
      const { data, error } = await supabase
        .from('stock_status')
        .select(`*, raw_materials(name, category, unit, min_stock) `)
        .eq('month', new Date(statusDate).toLocaleString('default', { month: 'short' }))
        .eq('year', new Date(statusDate).getFullYear());

      if (error) {
        throw error;
      }

      const transformedData = data.map((status: any) => {
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
      setAdjustments(transformedData.reduce((acc, status) => {
        acc[status.id] = status.adjustment;
        return acc;
      }, {} as Record<string, number>));
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

  // Determine status based on closing balance and min stock
  const determineStatus = (closing: number, min: number): 'normal' | 'low' | 'out' => {
    if (closing <= 0) return 'out';
    if (closing < min) return 'low';
    return 'normal';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Stock Status</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Opening Balance</TableHead>
              <TableHead>Purchases</TableHead>
              <TableHead>Utilized</TableHead>
              <TableHead>Adjustment</TableHead>
              <TableHead>Closing Balance</TableHead>
              <TableHead>Min. Level</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockStatus.map(status => (
              <TableRow key={status.id}>
                <TableCell>{status.raw_material_name}</TableCell>
                <TableCell>{status.raw_material_category}</TableCell>
                <TableCell>{status.opening_balance}</TableCell>
                <TableCell>{status.purchases}</TableCell>
                <TableCell>{status.utilized}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={adjustments[status.id] || 0}
                    onChange={(e) => setAdjustments({
                      ...adjustments,
                      [status.id]: parseFloat(e.target.value) || 0
                    })}
                    className="w-16 text-center"
                  />
                </TableCell>
                <TableCell>{status.opening_balance + status.purchases - status.utilized + (adjustments[status.id] || 0)}</TableCell>
                <TableCell>{status.min_level}</TableCell>
                <TableCell>{status.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
};

export default StockStatusPage;
