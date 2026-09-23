import React, { useState } from 'react';
import { useHousehold } from '../../contexts/HouseholdContext';
import { Settings, Save, Home } from 'lucide-react';

export const HostSettings: React.FC = () => {
  const { household, updateHousehold } = useHousehold();

  const [name, setName] = useState(household.householdName);
  const [apt, setApt] = useState(household.apartmentName);
  const [address, setAddress] = useState(household.address);
  const [desc, setDesc] = useState(household.description || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateHousehold({
      householdName: name,
      apartmentName: apt,
      address,
      description: desc,
    });
    alert('Household settings updated successfully.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
          <Settings className="w-3.5 h-3.5" />
          <span>Household Configuration</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Property & Apartment Details</h2>
        <p className="text-xs text-slate-500 mt-0.5">Manage apartment address and profile</p>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs max-w-2xl">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Household Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Apartment / Room Unit</label>
            <input
              type="text"
              value={apt}
              onChange={(e) => setApt(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Property Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
};

