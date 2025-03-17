import React, { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import TabButton from '@/components/TabButton';
import StatusBadge from '@/components/StatusBadge';
import { Edit, Trash, Plus, Download, Upload, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Purchases = () => {
  const [activeTab, setActiveTab] = useState('vendors');
  const navigate = useNavigate();

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Navigate to appropriate page for stockPurchases
    if (tab === 'stockPurchases') {
      navigate('/purchases/stock-purchases');
    }
  };

  return (
    <div>
      <PageHeader 
        title="Purchases" 
        description="Manage vendors, raw materials, and stock purchases" 
      />
      
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="p-4 flex gap-2">
          <TabButton 
            active={activeTab === 'vendors'} 
            label="Vendors" 
            onClick={() => handleTabChange('vendors')} 
          />
          <TabButton 
            active={activeTab === 'rawMaterials'} 
            label="Raw Materials" 
            onClick={() => handleTabChange('rawMaterials')} 
          />
          <TabButton 
            active={activeTab === 'stockPurchases'} 
            label="Stock Purchases" 
            onClick={() => handleTabChange('stockPurchases')} 
          />
        </div>
      </div>
      
      {activeTab === 'vendors' && <VendorsTab />}
      {activeTab === 'rawMaterials' && <RawMaterialsTab />}
    </div>
  );
};

const VendorsTab = () => {
  const vendors = [
    { id: 1, name: 'Spice Traders Ltd', contactPerson: 'John Smith', email: 'john@spicetraders.com', phone: '123-456-7890', gstin: 'GST1234567890' },
    { id: 2, name: 'Natural Herbs Co', contactPerson: 'Sarah Johnson', email: 'sarah@naturalherbs.com', phone: '987-654-3210', gstin: 'GST0987654321' },
    { id: 3, name: 'Farm Fresh Spices', contactPerson: 'Mike Davis', email: 'mike@farmfresh.com', phone: '555-123-4567', gstin: 'GST5551234567' },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <input
            type="text"
            placeholder="Search vendors..."
            className="search-input max-w-md"
          />
        </div>
        <button className="action-button">
          <Plus size={16} />
          Add Vendor
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Contact Person</th>
              <th>Email</th>
              <th>Phone</th>
              <th>GSTIN</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map(vendor => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                <td>{vendor.contactPerson}</td>
                <td>{vendor.email}</td>
                <td>{vendor.phone}</td>
                <td>{vendor.gstin}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:text-blue-800">
                      <Edit size={18} />
                    </button>
                    <button className="p-1 text-red-600 hover:text-red-800">
                      <Trash size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RawMaterialsTab = () => {
  const rawMaterials = [
    { id: 1, name: 'Red Chilli', code: 'RM001', category: 'Spices', minStock: 50, unit: 'kg' },
    { id: 2, name: 'Turmeric', code: 'RM002', category: 'Spices', minStock: 30, unit: 'kg' },
    { id: 3, name: 'Coriander Seeds', code: 'RM003', category: 'Seeds', minStock: 40, unit: 'kg' },
    { id: 4, name: 'Black Pepper', code: 'RM004', category: 'Spices', minStock: 25, unit: 'kg' },
    { id: 5, name: 'Cumin Seeds', code: 'RM005', category: 'Seeds', minStock: 20, unit: 'kg' },
  ];

  return (
    <div>
      <div className="mb-4 flex justify-between items-center">
        <div>
          <input
            type="text"
            placeholder="Search raw materials..."
            className="search-input max-w-md"
          />
        </div>
        <button className="action-button">
          <Plus size={16} />
          Add Raw Material
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>RM/Stock Name</th>
              <th>RM Code</th>
              <th>Category</th>
              <th>Min. Stock</th>
              <th>Unit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rawMaterials.map(material => (
              <tr key={material.id}>
                <td>{material.name}</td>
                <td>{material.code}</td>
                <td>{material.category}</td>
                <td>{material.minStock}</td>
                <td>{material.unit}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:text-blue-800">
                      <Edit size={18} />
                    </button>
                    <button className="p-1 text-red-600 hover:text-red-800">
                      <Trash size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Purchases;
