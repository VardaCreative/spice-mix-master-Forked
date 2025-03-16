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
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Edit, Trash, Plus, Search, Download, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import StockStatusPage from '@/pages/purchase/StockStatus';

// Types
interface Vendor {
  id: string;
  name: string;
}

interface RawMaterial {
  id: string;
  name: string;
  unit: string;
}

interface StockPurchase {
  id: string;
  date: string;
  vendor_id: string | null;
  vendor_name?: string;
  po_invoice: string | null;
  raw_material_id: string;
  raw_material_name?: string;
  raw_material_unit?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

// Initial form state
const initialFormState = {
  date: new Date().toISOString().substr(0, 10),
  vendor_id: '',
  po_invoice: '',
  raw_material_id: '',
  quantity: 0,
  unit_price: 0,
};

const StockPurchasesPage = () => {
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [formState, setFormState] = useState(initialFormState);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch data on component mount
  useEffect(() => {
    fetchStockPurchases();
    fetchVendors();
    fetchRawMaterials();
  }, []);

  // Fetch all stock purchases from the database
  const fetchStockPurchases = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock_purchases')
        .select(`
          *,
          vendors(name),
          raw_materials(name, unit)
        `)
        .order('date', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data to include vendor and raw material names
      const transformedData = data.map((purchase: any) => ({
        ...purchase,
        vendor_name: purchase.vendors?.name || 'Unknown Vendor',
        raw_material_name: purchase.raw_materials?.name || 'Unknown Material',
        raw_material_unit: purchase.raw_materials?.unit || 'unit',
      }));

      setPurchases(transformedData);
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

  // Fetch all vendors
  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name')
        .order('name');

      if (error) {
        throw error;
      }

      setVendors(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching vendors",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Fetch all raw materials
  const fetchRawMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('id, name, unit')
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

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ 
      ...prev, 
      [name]: ['quantity', 'unit_price'].includes(name) 
        ? parseFloat(value) || 0 
        : value 
    }));
  };

  // Handle form submission - either add or update a stock purchase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Calculate the total_amount manually
      const total_amount = formState.quantity * formState.unit_price;
      
      if (isEditing && currentPurchaseId) {
        // Update existing stock purchase
        const { error } = await supabase
          .from('stock_purchases')
          .update({
            ...formState,
            total_amount // Add the calculated total_amount
          })
          .eq('id', currentPurchaseId);

        if (error) throw error;
        
        toast({
          title: "Stock purchase updated",
          description: "The stock purchase has been updated successfully.",
        });
      } else {
        // Add new stock purchase
        const { error } = await supabase
          .from('stock_purchases')
          .insert([{
            ...formState,
            total_amount // Add the calculated total_amount
          }]);

        if (error) throw error;
        
        toast({
          title: "Stock purchase added",
          description: "The stock purchase has been added successfully.",
        });
      }

      // Reset form and refresh the list
      setFormState(initialFormState);
      setIsEditing(false);
      setCurrentPurchaseId(null);
      setIsDialogOpen(false);
      fetchStockPurchases();
    } catch (error: any) {
      toast({
        title: "Error saving stock purchase",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Edit a stock purchase
  const handleEdit = (purchase: StockPurchase) => {
    setFormState({
      date: purchase.date,
      vendor_id: purchase.vendor_id || '',
      po_invoice: purchase.po_invoice || '',
      raw_material_id: purchase.raw_material_id,
      quantity: purchase.quantity,
      unit_price: purchase.unit_price,
    });
    setIsEditing(true);
    setCurrentPurchaseId(purchase.id);
    setIsDialogOpen(true);
  };

  // Delete a stock purchase
  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this stock purchase?')) {
      try {
        const { error } = await supabase
          .from('stock_purchases')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        toast({
          title: "Stock purchase deleted",
          description: "The stock purchase has been deleted successfully.",
        });
        
        fetchStockPurchases();
      } catch (error: any) {
        toast({
          title: "Error deleting stock purchase",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  // Handle export to CSV
  const handleExport = () => {
    if (purchases.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no stock purchases to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Date', 'Vendor', 'PO/Invoice', 'RM/Stock Name', 'Quantity', 'Unit Price', 'Total'];
    const data = purchases.map(purchase => [
      purchase.date,
      purchase.vendor_name,
      purchase.po_invoice || '',
      purchase.raw_material_name,
      purchase.quantity.toString(),
      purchase.unit_price.toString(),
      purchase.total_amount.toString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(',') + '\n'
      + data.map(row => row.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stock_purchases_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: "Stock purchases data has been exported to CSV.",
    });
  };

  // Handle import from CSV
  const handleImport = () => {
    toast({
      title: "Import feature",
      description: "This feature is coming soon.",
    });
  };

  // Filter purchases based on search query
  const filteredPurchases = purchases.filter(purchase => 
    (purchase.vendor_name && purchase.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (purchase.po_invoice && purchase.po_invoice.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (purchase.raw_material_name && purchase.raw_material_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    purchase.date.includes(searchQuery)
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Stock Purchases</h1>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleImport}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setFormState(initialFormState);
                  setIsEditing(false);
                  setCurrentPurchaseId(null);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stock Purchase
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{isEditing ? 'Edit Stock Purchase' : 'Add New Stock Purchase'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="date">Date*</Label>
                      <Input
                        id="date"
                        name="date"
                        type="date"
                        value={formState.date}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="vendor_id">Vendor</Label>
                      <select
                        id="vendor_id"
                        name="vendor_id"
                        value={formState.vendor_id}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select a vendor</option>
                        {vendors.map(vendor => (
                          <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="po_invoice">PO/Invoice</Label>
                      <Input
                        id="po_invoice"
                        name="po_invoice"
                        value={formState.po_invoice}
                        onChange={handleChange}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="raw_material_id">RM/Stock Name*</Label>
                      <select
                        id="raw_material_id"
                        name="raw_material_id"
                        value={formState.raw_material_id}
                        onChange={handleChange}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select a raw material</option>
                        {rawMaterials.map(material => (
                          <option key={material.id} value={material.id}>{material.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="quantity">Quantity*</Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formState.quantity || ''}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="unit_price">Unit Price*</Label>
                      <Input
                        id="unit_price"
                        name="unit_price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={formState.unit_price || ''}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Total Amount</Label>
                      <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 font-mono">
                        ₹{(formState.quantity * formState.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">{isEditing ? 'Update' : 'Add'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="flex items-center w-full max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Search purchases..."
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
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PO/Invoice</TableHead>
                <TableHead>RM/Stock Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">Loading...</TableCell>
                </TableRow>
              ) : filteredPurchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10">
                    {searchQuery ? 'No purchases found matching your search.' : 'No stock purchases found. Add your first purchase!'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPurchases.map(purchase => (
                  <TableRow key={purchase.id}>
                    <TableCell>{new Date(purchase.date).toLocaleDateString()}</TableCell>
                    <TableCell>{purchase.vendor_name}</TableCell>
                    <TableCell>{purchase.po_invoice || '-'}</TableCell>
                    <TableCell>{purchase.raw_material_name}</TableCell>
                    <TableCell>{purchase.quantity} {purchase.raw_material_unit}</TableCell>
                    <TableCell>₹{purchase.unit_price.toFixed(2)}</TableCell>
                    <TableCell>₹{purchase.total_amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(purchase)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(purchase.id)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="p-4 text-sm text-gray-500 border-t">
            Showing {filteredPurchases.length} of {purchases.length} stock purchases
          </div>
        </div>
      </div>
      <StockStatusPage /> {/* Ensure StockStatusPage is correctly referenced here */}
    </Layout>
  );
};

export default StockPurchasesPage;
