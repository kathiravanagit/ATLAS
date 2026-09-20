import { AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area } from 'recharts';
import { useState, useEffect } from 'react';
import { timeAgo } from '../lib/utils';

interface RiskTrendChartProps {
  data: number[];
}

export default function RiskTrendChart({ data }: RiskTrendChartProps) {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [relativeTime, setRelativeTime] = useState("just now");

  useEffect(() => {
    setLastUpdated(new Date());
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(timeAgo(lastUpdated));
    }, 5000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const chartData = data.map((value, index) => {
    const hour = (18 + index) % 24;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      time: `${displayHour}:00 ${period}`,
      risk: value,
    };
  });

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base text-[#1F2937]">Risk Trend — Last 6 Hours</h3>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Synthetic demonstration values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#6B7280] bg-white px-2 py-1 rounded-lg border border-[#D1D5DB]">
            Updated {relativeTime}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-[#15803D]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse"></span>
            Live
          </div>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D355B" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#1D355B" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#6B7280', fontSize: 11 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#6B7280', fontSize: 11 }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#6B7280' }}
              formatter={(value: number) => [`${value}%`, 'Risk Score']}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#1D355B"
              strokeWidth={1.5}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
