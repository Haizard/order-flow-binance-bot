
'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell, // Import Cell for customizing bar colors
} from 'recharts';
import type { FootprintBar, PriceLevelData } from '@/types/footprint';

interface GraphicalFootprintBarProps {
  bar: Partial<FootprintBar>;
}

// Custom tick component for Y-axis to highlight POC
const CustomizedYAxisTick = (props: any) => {
  const { x, y, payload, pocPriceDisplay } = props;
  const isPoc = payload.value === pocPriceDisplay;

  // Check if the tick value corresponds to the open, high, low, or close price of the bar
  // This part is removed as it was adding too much visual clutter and complexity for this step.
  // We will focus only on POC highlighting for now.

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={3.5} // Minor adjustment for vertical alignment
        textAnchor="end"
        fill={isPoc ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
        fontWeight={isPoc ? "bold" : "normal"}
        fontSize={9}
      >
        {payload.value}
      </text>
    </g>
  );
};


const GraphicalFootprintBar: React.FC<GraphicalFootprintBarProps> = ({ bar }) => {
  const [pocInfo, setPocInfo] = useState<{ priceDisplay: string; totalVolume: number } | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!bar || !bar.priceLevels) {
      setChartData([]);
      setPocInfo(null);
      return;
    }

    const priceLevelsMap = bar.priceLevels instanceof Map
      ? bar.priceLevels
      : new Map(Object.entries(bar.priceLevels as Record<string, PriceLevelData>));

    if (priceLevelsMap.size === 0) {
      setChartData([]);
      setPocInfo(null);
      return;
    }

    const processedData = Array.from(priceLevelsMap.entries())
      .map(([priceStr, data]) => {
        const price = parseFloat(priceStr);
        return {
          priceDisplay: price.toFixed(Math.max(2, price < 1 && price !== 0 ? 5 : 2)),
          priceValue: price,
          buyVolume: data.buyVolume || 0,
          sellVolume: data.sellVolume || 0,
        };
      })
      .sort((a, b) => b.priceValue - a.priceValue); // Sort descending by priceValue
    
    setChartData(processedData);

    // Calculate POC
    if (processedData.length > 0) {
      let maxVolume = -1;
      let currentPoc: { priceDisplay: string; totalVolume: number } | null = null;
      processedData.forEach(level => {
        const totalVolAtLevel = (level.buyVolume || 0) + (level.sellVolume || 0);
        if (totalVolAtLevel > maxVolume) {
          maxVolume = totalVolAtLevel;
          currentPoc = { priceDisplay: level.priceDisplay, totalVolume: maxVolume };
        }
      });
      setPocInfo(currentPoc);
    } else {
      setPocInfo(null);
    }

  }, [bar]);


  // Initial checks for data availability
  const isMap = bar.priceLevels instanceof Map;
  const isPlainObject = typeof bar.priceLevels === 'object' && bar.priceLevels !== null && !isMap;

  if (!bar || !bar.priceLevels) {
    return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for graphical display.</p>;
  }
  if (isMap && (bar.priceLevels as Map<string, PriceLevelData>).size === 0) {
     return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for graphical display (empty map).</p>;
  }
  if (isPlainObject && Object.keys(bar.priceLevels as Record<string, PriceLevelData>).length === 0) {
     return <p className="text-muted-foreground text-xs py-2 text-center">No price level data for graphical display (empty object).</p>;
  }
   if (!isMap && !isPlainObject) {
    return <p className="text-muted-foreground text-xs py-2 text-center">Price level data is not a valid Map or Object.</p>;
  }

  if (chartData.length === 0) {
      return <p className="text-muted-foreground text-xs py-2 text-center">No chartable data after processing.</p>;
  }
  
  return (
    <div className="mt-2 h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{
            top: 5,
            right: 25, 
            left: 15, // Adjusted left margin for potentially longer Y-axis labels
            bottom: 20, 
          }}
          barCategoryGap="10%" 
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            type="number" 
            domain={[0, 'auto']}
            tickFormatter={(value) => value.toFixed(Math.max(0, (value < 1 && value !==0 ? 1:0)))} 
            stroke="hsl(var(--muted-foreground))" 
            fontSize={10} 
            allowDecimals={true}
          />
          <YAxis
            type="category"
            dataKey="priceDisplay"
            width={70} // Increased width for Y-axis labels
            reversed 
            tick={<CustomizedYAxisTick pocPriceDisplay={pocInfo?.priceDisplay} />}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
            interval={0} 
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
          <Bar dataKey="sellVolume" name="Sell Vol" stackId="a" fill="hsl(var(--destructive))" barSize={8} radius={[0, 2, 2, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-sell-${index}`} fill={entry.priceDisplay === pocInfo?.priceDisplay ? "hsla(var(--destructive-h), var(--destructive-s), calc(var(--destructive-l) + 10%), 0.9)" : "hsl(var(--destructive))"} />
            ))}
          </Bar>
          <Bar dataKey="buyVolume" name="Buy Vol" stackId="a" fill="hsl(var(--accent))" barSize={8} radius={[0, 2, 2, 0]}>
             {chartData.map((entry, index) => (
              <Cell key={`cell-buy-${index}`} fill={entry.priceDisplay === pocInfo?.priceDisplay ? "hsla(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 10%), 0.9)" : "hsl(var(--accent))"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {pocInfo && (
        <div className="text-center text-xs text-muted-foreground mt-1.5">
          POC: <span className="font-semibold text-primary">{pocInfo.priceDisplay}</span> (Vol: {pocInfo.totalVolume.toFixed(2)})
        </div>
      )}
    </div>
  );
};

export default GraphicalFootprintBar;

