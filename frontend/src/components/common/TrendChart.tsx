import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

export function TrendChart({ likes, bookmarks, views }: { likes: number; bookmarks: number; views: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      color: ['#b95d36', '#315f8f', '#60705a'],
      grid: { left: 36, right: 16, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五'], axisLine: { show: false }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: 'rgba(24,23,19,0.12)' } } },
      series: [
        { type: 'line', smooth: true, name: '浏览', data: [views * 0.12, views * 0.16, views * 0.18, views * 0.24, views * 0.3] },
        { type: 'line', smooth: true, name: '点赞', data: [likes * 0.1, likes * 0.18, likes * 0.2, likes * 0.23, likes * 0.29] },
        { type: 'line', smooth: true, name: '收藏', data: [bookmarks * 0.08, bookmarks * 0.16, bookmarks * 0.22, bookmarks * 0.25, bookmarks * 0.3] },
      ],
      tooltip: { trigger: 'axis' },
    });
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [likes, bookmarks, views]);

  return <div ref={ref} className="h-72 w-full border border-ink/15 bg-rice" />;
}
