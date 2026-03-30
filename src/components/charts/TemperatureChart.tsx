import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Circle } from 'react-native-svg';
import { TemperatureReading } from '../../services/api/historicalWeather';

const COLORS = {
  safe: '#8ECAE6',
  caution: '#F4A261',
  high: '#E76F51',
  critical: '#E63946',
  ocean: '#1D3557',
};

interface Props {
  data: TemperatureReading[];
}

export default function TemperatureChart({ data }: Props) {
  const width = Dimensions.get('window').width - 80;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxTemp = Math.max(...data.map(d => d.temperature));
  const minTemp = Math.min(...data.map(d => d.temperature));
  const tempRange = maxTemp - minTemp;

  // Scale functions
  const xScale = (index: number) => (index / (data.length - 1)) * chartWidth + padding.left;
  const yScale = (temp: number) => chartHeight - ((temp - minTemp) / tempRange) * chartHeight + padding.top;

  // Create path for line chart
  const linePath = data.map((reading, i) => {
    const x = xScale(i);
    const y = yScale(reading.temperature);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');

  // Create path for area fill
  const areaPath = linePath + 
    ` L ${xScale(data.length - 1)} ${chartHeight + padding.top}` +
    ` L ${padding.left} ${chartHeight + padding.top} Z`;

  const formatTime = (index: number) => {
    if (index < 0 || index >= data.length) return '';
    const hour = data[index].time.getHours();
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  const xTicks = [0, 6, 12, 18, 23];
  const yTicks = [
    Math.floor(minTemp),
    Math.floor((minTemp + maxTemp) / 2),
    Math.ceil(maxTemp)
  ];

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {yTicks.map((temp, i) => {
          const y = yScale(temp);
          return (
            <Line
              key={`grid-${i}`}
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#F3F4F6"
              strokeWidth="1"
              strokeDasharray="5,5"
            />
          );
        })}

        {/* Area fill */}
        <Path
          d={areaPath}
          fill={COLORS.high}
          fillOpacity={0.2}
        />

        {/* Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={COLORS.high}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((reading, i) => {
          if (i % 2 !== 0) return null; // Show every other point
          const x = xScale(i);
          const y = yScale(reading.temperature);
          return (
            <Circle
              key={`point-${i}`}
              cx={x}
              cy={y}
              r="4"
              fill="white"
              stroke={COLORS.high}
              strokeWidth="2"
            />
          );
        })}

        {/* Y Axis labels */}
        {yTicks.map((temp, i) => {
          const y = yScale(temp);
          return (
            <SvgText
              key={`y-label-${i}`}
              x={padding.left - 10}
              y={y + 4}
              fontSize="12"
              fill="#6B7280"
              textAnchor="end"
            >
              {temp}°
            </SvgText>
          );
        })}

        {/* X Axis labels */}
        {xTicks.map((index, i) => {
          const x = xScale(index);
          return (
            <SvgText
              key={`x-label-${i}`}
              x={x}
              y={height - 10}
              fontSize="12"
              fill="#6B7280"
              textAnchor="middle"
            >
              {formatTime(index)}
            </SvgText>
          );
        })}

        {/* Axes */}
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight + padding.top}
          stroke="#E5E7EB"
          strokeWidth="2"
        />
        <Line
          x1={padding.left}
          y1={chartHeight + padding.top}
          x2={width - padding.right}
          y2={chartHeight + padding.top}
          stroke="#E5E7EB"
          strokeWidth="2"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
});
