import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  ChevronDown,
  ChevronUp,
  Calendar,
  Package,
  TrendingUp,
} from 'lucide-react';
import { DataRow } from './DataTable';

interface DashboardChartsProps {
  data: DataRow[];
  columns: string[];
}

const MOX_CHART_COLORS = [
  '#0EA5C9', // Cyan
  '#16A34A', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#EA580C', // Orange
  '#14B8A6', // Teal
];

function parseNumericValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ data, columns }) => {
  // Collapsible toggle: Hidden/minimized by default as requested!
  const [isOpen, setIsOpen] = useState(false);

  // Preset view mode: 'stock' | 'expiry' | 'amount'
  const [viewPreset, setViewPreset] = useState<'stock' | 'expiry' | 'amount'>('stock');

  // Identify key columns
  const quantityCol = useMemo(() => {
    return columns.find((c) => /quantity|qty|units_on_hand|stock/i.test(c)) || null;
  }, [columns]);

  const expiryCol = useMemo(() => {
    return columns.find((c) => /expiry|expiration|due_date|date/i.test(c)) || null;
  }, [columns]);

  const amountCol = useMemo(() => {
    return columns.find((c) => /total.*amount|amount|net_pay|price|cost/i.test(c)) || null;
  }, [columns]);

  const itemCol = useMemo(() => {
    return (
      columns.find((c) => /product|item|description|sku|name/i.test(c)) ||
      columns[0] ||
      ''
    );
  }, [columns]);

  // Aggregate Data based on preset (Stock-wise, Expiry Date-wise, or Amount-wise)
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const map = new Map<string, number>();

    if (viewPreset === 'expiry' && expiryCol) {
      // Date-wise / Expiry-wise grouping
      data.forEach((row) => {
        const rawDate = row[expiryCol];
        const dateLabel = rawDate ? String(rawDate).trim() : 'No Date';
        const metricVal = quantityCol ? parseNumericValue(row[quantityCol]) : 1;
        map.set(dateLabel, (map.get(dateLabel) || 0) + metricVal);
      });
    } else if (viewPreset === 'stock' && quantityCol) {
      // Stock-wise by product / item
      data.forEach((row) => {
        const label = String(row[itemCol] || 'Unknown').trim();
        const qty = parseNumericValue(row[quantityCol]);
        map.set(label, (map.get(label) || 0) + qty);
      });
    } else {
      // Amount / Value-wise
      const valCol = amountCol || quantityCol || columns[1] || columns[0];
      data.forEach((row) => {
        const label = String(row[itemCol] || 'Item').trim();
        const val = parseNumericValue(row[valCol]);
        map.set(label, (map.get(label) || 0) + val);
      });
    }

    const result = Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));

    result.sort((a, b) => b.value - a.value);
    return result;
  }, [data, viewPreset, expiryCol, quantityCol, amountCol, itemCol, columns]);

  if (data.length === 0) return null;

  return (
    <div className="w-full pt-2">
      {/* Collapsible Section Trigger Header */}
      <div className="mox-card p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#E0F4FA] border border-[#BFE3EE] flex items-center justify-center text-[#0EA5C9]">
            <BarChart3 className="w-4 h-4 text-[#0EA5C9]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">Visual Analytics</h3>
            <p className="text-xs text-[#64748B]">Date-wise and stock-wise breakdown charts</p>
          </div>
        </div>

        {/* View Analytics Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="mox-btn text-sm font-bold py-2 px-4 shadow-sm flex items-center gap-2"
        >
          <span>{isOpen ? 'Hide Analytics' : 'View Analytics'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
        </button>
      </div>

      {/* Expanded Chart View */}
      {isOpen && (
        <div className="space-y-3.5 mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Preset Selector Bar */}
          <div className="mox-card p-3 flex flex-wrap items-center justify-between gap-2.5">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
              Select Chart Focus:
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewPreset('stock')}
                className={`mox-btn text-xs font-bold py-1.5 px-3 rounded-lg ${
                  viewPreset === 'stock'
                    ? 'bg-[#0EA5C9] text-white border-[#0EA5C9]'
                    : 'bg-[#F8FAFC] text-[#0F172A]'
                }`}
              >
                <Package className="w-3.5 h-3.5 mr-1" />
                <span>Stock-wise (Units)</span>
              </button>

              <button
                onClick={() => setViewPreset('expiry')}
                className={`mox-btn text-xs font-bold py-1.5 px-3 rounded-lg ${
                  viewPreset === 'expiry'
                    ? 'bg-[#0EA5C9] text-white border-[#0EA5C9]'
                    : 'bg-[#F8FAFC] text-[#0F172A]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <span>Date-wise (Expiry)</span>
              </button>

              <button
                onClick={() => setViewPreset('amount')}
                className={`mox-btn text-xs font-bold py-1.5 px-3 rounded-lg ${
                  viewPreset === 'amount'
                    ? 'bg-[#0EA5C9] text-white border-[#0EA5C9]'
                    : 'bg-[#F8FAFC] text-[#0F172A]'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                <span>Amount / Value ($)</span>
              </button>
            </div>
          </div>

          {/* Dual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* 1. BAR CHART */}
            <div className="mox-card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#0EA5C9]" />
                  <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                    {viewPreset === 'stock'
                      ? 'Stock Levels by Product'
                      : viewPreset === 'expiry'
                      ? 'Quantity Expiring by Date'
                      : 'Financial Amount Distribution'}
                  </h4>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.slice(0, 8)} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E8EC" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: '#0F172A', fontWeight: 500 }}
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E8EC',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.slice(0, 8).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={MOX_CHART_COLORS[index % MOX_CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. PIE CHART */}
            <div className="mox-card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-[#16A34A]" />
                  <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                    Percentage Share
                  </h4>
                </div>
              </div>

              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.slice(0, 7)}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={48}
                      paddingAngle={3}
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${(name || '').slice(0, 10)}: ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {chartData.slice(0, 7).map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={MOX_CHART_COLORS[index % MOX_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E5E8EC',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                      formatter={(value) => <span style={{ color: '#0F172A', fontWeight: 600 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCharts;
