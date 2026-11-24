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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1C1F]">Risk trend</h3>
          <p className="mt-0.5 text-[12px] text-[#5F6368]">Last 6 hours · demonstration values</p>
        </div>
        <span className="shrink-0 rounded-lg border border-[#E2E1DB] bg-white px-2 py-1 text-[11px] text-[#5F6368]">
          Updated {relativeTime}
        </span>
      </div>
      <div className={data.length === 0 ? 'py-6' : 'h-[200px]'}>
        {data.length === 0 ? (
          <p className="text-[12px] text-[#8A8D90]">
            No trend data yet — connect the backend to populate this chart.
          </p>
        ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E1DB" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#5F6368', fontSize: 11 }}
              axisLine={{ stroke: '#E2E1DB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#5F6368', fontSize: 11 }}
              axisLine={{ stroke: '#E2E1DB' }}
              tickLine={false}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #D2D1CA',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#5F6368' }}
              formatter={(value: number) => [`${value}`, 'Risk Score']}
            />
            <Area
              type="monotone"
              dataKey="risk"
              stroke="#12355B"
              strokeWidth={1.5}
              fill="#F1F1EC"
            />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
