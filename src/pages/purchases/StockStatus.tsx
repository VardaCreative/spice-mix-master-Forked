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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStockStatus();
  }, []);

  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_status')
        .select('*');
      
      if (error) throw error;
      setStockStatus(data || []);
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

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Stock Status</h1>
        <Button onClick={fetchStockStatus} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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
                <TableCell colSpan={9} className="text-center py-10">No data available.</TableCell>
              </TableRow>
            ) : (
              stockStatus.map((status) => (
                <TableRow key={status.id}>
                  <TableCell>{status.raw_material_name}</TableCell>
                  <TableCell>{status.raw_material_category}</TableCell>
                  <TableCell>{status.opening_balance}</TableCell>
                  <TableCell>{status.purchases}</TableCell>
                  <TableCell>{status.utilized}</TableCell>
                  <TableCell>{status.adjustment}</TableCell>
                  <TableCell>{status.closing_balance}</TableCell>
                  <TableCell>{status.min_level}</TableCell>
                  <TableCell>{status.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
};

export default StockStatusPage;
