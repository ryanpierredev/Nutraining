import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { dateLabel, measure } from '../lib/api';
import { Card, Choice, Copy, useTheme } from './ui';

export type Checkin = { day: string; weightKg: number; waistCm: number | null; notes: string };

export default function ProgressChart({ entries }: { entries: Checkin[] }) {
  const { colors, s } = useTheme();
  const [metric, setMetric] = useState<'weightKg' | 'waistCm'>('weightKg');
  const unit = metric === 'weightKg' ? 'kg' : 'cm';
  const points = entries.slice().reverse().flatMap(entry => {
    const value = entry[metric];
    return value === null ? [] : [{ day: entry.day, time: Date.parse(entry.day), value }];
  });
  const first = points[0];
  const last = points[points.length - 1];
  const min = Math.min(...points.map(p => p.value));
  const max = Math.max(...points.map(p => p.value));
  // Position readings by the day they were taken, including gaps between check-ins.
  const x = (time: number) => first.time === last.time ? 160 : 6 + (time - first.time) * 308 / (last.time - first.time);
  const y = (value: number) => max === min ? 48 : 87 - (value - min) * 78 / (max - min);
  return <Card accent>
    <View style={s.row}><Choice title="Peso" selected={metric === 'weightKg'} onPress={() => setMetric('weightKg')} />
      <Choice title="Cintura" selected={metric === 'waistCm'} onPress={() => setMetric('waistCm')} /></View>
    {last ? <>
      <View style={s.spread}><Text style={s.stat}>{measure(last.value)} <Text style={s.heading}>{unit}</Text></Text>
        <Text style={s.copy}>{dateLabel(last.day)}</Text></View>
      {points.length > 1 && <>
        <View accessible accessibilityLabel={`De ${measure(first.value)} a ${measure(last.value)} ${unit}, entre ${dateLabel(first.day)} e ${dateLabel(last.day)}.`}>
          <Svg width="100%" height={100} viewBox="0 0 320 96" preserveAspectRatio="none">
            {[9, 48, 87].map(h => <Line key={h} x1={6} x2={314} y1={h} y2={h} stroke={colors.line} strokeDasharray="3 5" />)}
            <Polyline points={points.map(p => `${x(p.time)},${y(p.value)}`).join(' ')} fill="none" stroke={colors.green} strokeWidth={3} strokeLinejoin="round" />
            <Circle cx={x(first.time)} cy={y(first.value)} r={3.5} fill={colors.green} /><Circle cx={x(last.time)} cy={y(last.value)} r={4} fill={colors.green} />
          </Svg>
          <View style={s.spread}><Text style={s.copy}>{dateLabel(first.day)}</Text><Text style={s.copy}>{dateLabel(last.day)}</Text></View>
        </View>
        <Copy>Variação no período: {last.value > first.value ? '+' : ''}{measure(last.value - first.value)} {unit}</Copy>
      </>}
      {points.length === 1 && <Copy>Com duas medidas no período, você verá a variação no gráfico.</Copy>}
    </> : <Copy>Nenhuma medida de {metric === 'weightKg' ? 'peso' : 'cintura'} neste período.</Copy>}
  </Card>;
}
