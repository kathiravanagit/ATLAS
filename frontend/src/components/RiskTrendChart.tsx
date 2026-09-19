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
          <h3 className="font-semibold text-base text-white">Risk Trend — Last 6 Hours</h3>
          <p className="text-sm text-[#d4d4d8] mt-0.5">
            Synthetic demonstration values
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#d4d4d8] bg-[#18181b] px-2 py-1 rounded-lg border border-[#27272a]">
            Updated {relativeTime}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-[#22c55e]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
            Live
          </div>
        </div>
      </div>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fff" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#d4d4d8', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#d4d4d8', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#d4d4d8' }}
              formatter={(value: number) => [`${value}%`, 'Risk Score']}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#fafafa"
              strokeWidth={1.5}
              fill="url(#riskGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
