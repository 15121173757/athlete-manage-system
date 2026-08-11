'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ClipboardList, Dumbbell, CalendarDays, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuickActionsCard } from './components/QuickActionsCard';
import { AcwrRiskCard } from './components/AcwrRiskCard';

interface Stats {
  totalAthletes: number;
  todayPlanAthletes: number;
  publishedPlans: number;
  pendingRecords: number;
  injuredAthletes: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalAthletes: 0,
    todayPlanAthletes: 0,
    publishedPlans: 0,
    pendingRecords: 0,
    injuredAthletes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [athletesRes, plansRes, todayRes] = await Promise.all([
          fetch('/api/athletes?pageSize=1'),
          fetch('/api/training/plans?pageSize=1&status=PUBLISHED'),
          fetch('/api/training/plans/today'),
        ]);
        const athletesJson = await athletesRes.json();
        const plansJson = await plansRes.json();
        const todayJson = await todayRes.json();

        if (athletesJson.success) {
          setStats((prev) => ({
            ...prev,
            totalAthletes: athletesJson.data.total,
          }));
        }
        if (plansJson.success) {
          setStats((prev) => ({
            ...prev,
            publishedPlans: plansJson.data.total,
          }));
        }
        if (todayJson.success) {
          setStats((prev) => ({
            ...prev,
            todayPlanAthletes: todayJson.data.total,
          }));
        }
      } catch { /* empty */ }
      finally { setIsLoading(false); }
    };
    fetchStats();
  }, []);

  const statCards = [
    {
      label: '运动员总数',
      value: stats.totalAthletes,
      desc: '在队 + 休养 + 离队',
      icon: Users,
      color: 'text-ams-primary',
      bgColor: 'bg-ams-primary/10',
      link: '/athletes',
    },
    {
      label: '今日计划',
      value: stats.todayPlanAthletes || '-',
      desc: '今日有训练计划的用户',
      icon: CalendarDays,
      color: 'text-ams-success',
      bgColor: 'bg-ams-success/10',
      link: '/training/today-plans',
    },
    {
      label: '已发布计划',
      value: stats.publishedPlans,
      desc: '进行中的训练计划',
      icon: ClipboardList,
      color: 'text-ams-warning',
      bgColor: 'bg-ams-warning/10',
      link: '/training/plans',
    },
    {
      label: '待处理记录',
      value: stats.pendingRecords || '-',
      desc: '待审核训练记录',
      icon: Dumbbell,
      color: 'text-ams-text-primary',
      bgColor: 'bg-ams-text-muted/10',
      link: '/training/records',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.link}
              className="ams-card ams-card-hover p-5 block"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-ams ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-ams-text-muted" />
              </div>
              <div className="text-2xl font-bold text-ams-text-primary mb-1">
                {isLoading ? '-' : card.value}
              </div>
              <div className="text-sm font-medium text-ams-text-primary">{card.label}</div>
              <div className="text-xs text-ams-text-muted mt-0.5">{card.desc}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QuickActionsCard />

        {/* 风险预警卡片（基于 ACWR 数值判定） */}
        <AcwrRiskCard />
      </div>
    </div>
  );
}