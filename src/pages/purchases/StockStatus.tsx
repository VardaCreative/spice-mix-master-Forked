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

const StockStatusPage = () => {
  const [stockStatus, setStockStatus] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [adjustments, setAdjustments] = useState({});
  const { toast } = useToast();

  const fetchStockStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_status')
        .select('*');

      if (error) throw error;

      const updatedData = data.map(item => ({
        ...item,
        closing_balance: item.opening_balance + item.purchases - item.utilized + (adjustments[item.id] || 0),
      }));
      setStockStatus(updatedData);
    } catch (error) {
      toast({ title: 'Error fetching stock status', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockStatus();
  }, []);

  const handleAdjustmentChange = (id, value) => {
    setAdjustments(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const handleUpdateStatus = async () => {
    try {
      setLoading(true);
      for (const status of stockStatus) {
        const newAdjustment = adjustments[status.id] || 0;
        const newClosingBalance = status.opening_balance + status.purchases - status.utilized + newAdjustment;
        await supabase
          .from('stock_status')
          .update({ adjustment: newAdjustment, closing_balance: newClosingBalance })
          .eq('id', status.id);
      }
      toast({ title: 'Stock status updated', description: 'Stock status successfully updated.' });
      fetchStockStatus();
    } catch (error) {
      toast({ title: 'Error updating stock status', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Stock Status</h1>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex flex-wrap gap-4 items-end">
            <Label>Status Date</Label>
            <Input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} className="w-40" />
            <Button onClick={handleUpdateStatus} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Update Status</Button>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stock Name</TableHead>
                <TableHead>Opening Balance</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Utilized</TableHead>
                <TableHead>Adj +/-</TableHead>
                <TableHead>Closing Bal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Loading...</TableCell>
                </TableRow>
              ) : (
                stockStatus.map(status => (
                  <TableRow key={status.id}>
                    <TableCell>{status.raw_material_name}</TableCell>
                    <TableCell>{status.opening_balance}</TableCell>
                    <TableCell>{status.purchases}</TableCell>
                    <TableCell>{status.utilized}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={adjustments[status.id] || 0}
                        onChange={(e) => handleAdjustmentChange(status.id, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>{status.closing_balance}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
};

export default StockStatusPage;
