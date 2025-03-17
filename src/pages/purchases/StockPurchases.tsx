import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StockPurchase {
  id: string;
  vendor: string;
  raw_material: string;
  quantity: number;
  date: string;
}

const StockPurchases = () => {
  const [stockPurchases, setStockPurchases] = useState<StockPurchase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [newPurchase, setNewPurchase] = useState<Partial<StockPurchase>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchStockPurchases();
  }, []);

  const fetchStockPurchases = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof StockPurchase, value: string | number) => {
    setNewPurchase(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPurchase = async () => {
    try {
      const { vendor, raw_material, quantity, date } = newPurchase;
      if (!vendor || !raw_material || !quantity || !date) {
        toast({
          title: "Error",
          description: "All fields are required",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('stock_purchases')
        .insert([newPurchase]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stock purchase added successfully",
      });

      setNewPurchase({});
      fetchStockPurchases();
    } catch (error: any) {
      toast({
        title: "Error adding stock purchase",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredStockPurchases = stockPurchases.filter(purchase =>
    purchase.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
    purchase.raw_material.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Stock Purchases</h1>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search" className="block mb-1">Search</Label>
              <Input
                id="search"
                type="search"
                placeholder="Search stock purchases..."
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Raw Material</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">Loading...</TableCell>
                  </TableRow>
                ) : filteredStockPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">No stock purchases found</TableCell>
                  </TableRow>
                ) : (
                  filteredStockPurchases.map(purchase => (
                    <TableRow key={purchase.id}>
                      <TableCell>{purchase.vendor}</TableCell>
                      <TableCell>{purchase.raw_material}</TableCell>
                      <TableCell>{purchase.quantity}</TableCell>
                      <TableCell>{purchase.date}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="bg-white p-4 rounded-lg shadow-sm mt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1">
              <Label htmlFor="vendor" className="block mb-1">Vendor</Label>
              <Input
                id="vendor"
                type="text"
                value={newPurchase.vendor || ''}
                onChange={(e) => handleInputChange('vendor', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="raw_material" className="block mb-1">Raw Material</Label>
              <Input
                id="raw_material"
                type="text"
                value={newPurchase.raw_material || ''}
                onChange={(e) => handleInputChange('raw_material', e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="quantity" className="block mb-1">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={newPurchase.quantity || ''}
                onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="date" className="block mb-1">Date</Label>
              <Input
                id="date"
                type="date"
                value={newPurchase.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={handleAddPurchase} className="self-end">
              <Plus className="mr-2 h-4 w-4" />
              Add Purchase
            </Button>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <Button
            onClick={fetchStockPurchases}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default StockPurchases;
