import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

export default function CompanySwitcher() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchCos = async () => {
      try {
        const res = await fetch('/api/agents/companies');
        const data = await res.json();
        setCompanies(data.companies || []);
        if (data.companies?.length > 0) {
          setSelected(data.companies[0]);
        }
      } catch (err) {
        console.error('Failed to fetch companies');
      }
    };
    fetchCos();
  }, []);

  if (!selected) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-indigo-700 dark:text-indigo-300 font-bold text-sm transition-all hover:bg-indigo-100"
      >
        <Building2 className="w-4 h-4" />
        <span>{selected.name}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-[10px] font-bold text-gray-400 uppercase px-2">בחר חברה</span>
            </div>
            {companies.map(co => (
              <button 
                key={co.id}
                onClick={() => { setSelected(co); setIsOpen(false); }}
                className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 opacity-40" />
                  <span className={selected.id === co.id ? "font-bold text-indigo-600" : ""}>{co.name}</span>
                </div>
                {selected.id === co.id && <Check className="w-3 h-3 text-indigo-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
