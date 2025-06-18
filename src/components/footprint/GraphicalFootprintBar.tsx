
'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';

interface GraphicalFootprintBarProps {
  bar: Partial<FootprintBar>;
}

const GraphicalFootprintBar: React.FC<GraphicalFootprintBarProps> = ({ bar }) => {
  if (!bar || !bar.priceLevels || (bar.priceLevels instanceof Map && bar.priceLevels.size === 0) || (typeof bar.priceLevels === 'object' && Object.keys(bar.priceLevels).length === 0) ) {
    return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for graphical display.</p>;
  }

  const priceLevelsMap = bar.priceLevels instanceof Map
    ? bar.priceLevels
    : new Map(Object.entries(bar.priceLevels || {}));

  if (priceLevelsMap.size === 0) {
    return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for graphical display after map conversion.</p>;
  }
  
  const chartData = Array.from(priceLevelsMap.entries())
    .map(([priceStr, data]) => {
      const price = parseFloat(priceStr);
      return {
        priceDisplay: price.toFixed(Math.max(2, (price < 1 ? 5 : 2))), // For Y-axis label
        priceValue: price, // For sorting
        buyVolume: data.buyVolume || 0,
        sellVolume: data.sellVolume || 0,
      };
    })
    .sort((a, b) => b.priceValue - a.priceValue); // Sort descending by priceValue

  if (chartData.length === 0) {
      return <p className="text-muted-foreground text-xs py-2 text-center">No chartable data after processing.</p>;
  }
  
  const maxVolumeAtLevel = Math.max(
    ...chartData.map(pl => Math.max(pl.buyVolume, pl.sellVolume)),
    0.01 // Ensure a small minimum for the domain if all volumes are 0
  );

  return (
    <div className="mt-2 h-80 w-full"> {/* Increased height for better chart visibility */}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{
            top: 5,
            right: 25, 
            left: 45, 
            bottom: 15, // Increased bottom margin for legend
          }}
          barCategoryGap="10%" // Percentage gap between categories
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            domain={[0, 'auto']} // Let recharts determine max, or use maxVolumeAtLevel
            tickFormatter={(value) => value.toFixed(1)} 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={10} 
            allowDecimals={true}
          />
          <YAxis
            type="category"
            dataKey="priceDisplay"
            width={75} 
            reversed 
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            interval={0} // Show all ticks if possible
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '11px' }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold', marginBottom: '4px' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => [value.toFixed(Math.max(2, (value < 1 && value !== 0 ? 5 : 2))), name === 'buyVolume' ? 'Buy Vol' : 'Sell Vol']}
            labelFormatter={(label) => `Price: ${label}`}
          />
          <Legend 
            wrapperStyle={{fontSize: "10px", paddingTop: "10px", paddingBottom: "0px", marginTop: "auto" }} 
            verticalAlign="bottom"
            align="center"
            height={30}
          />
          <Bar dataKey="sellVolume" name="Sell Vol" fill="hsl(var(--destructive))" barSize={8} radius={[0, 2, 2, 0]} />
          <Bar dataKey="buyVolume" name="Buy Vol" fill="hsl(var(--accent))" barSize={8} radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GraphicalFootprintBar;
