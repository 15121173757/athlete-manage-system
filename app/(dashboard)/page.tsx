'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, ClipboardList, Dumbbell, Activity, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth/auth-store';
import { QuickActionsCard } from './components/QuickActionsCard';
import { AcwrRiskCard } from './components/AcwrRiskCard';

interface Stats {
  totalAthletes: number;
  activeAthletes: number;
  publishedPlans: number;
  pendingRecords: number;
  injuredAthletes: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats>({
    totalAthletes: 0,
    activeAthletes: 0,
    publishedPlans: 0,
    pendingRecords: 0,
    injuredAthletes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [athletesRes, plansRes] = await Promise.all([
          fetch('/api/athletes?pageSize=1'),
          fetch('/api/training/plans?pageSize=1&status=PUBLISHED'),
        ]);
        const athletesJson = await athletesRes.json();
        const plansJson = await plansRes.json();

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
      label: '活跃运动员',
      value: stats.activeAthletes || '-',
      desc: '当前在队人数',
      icon: Activity,
      color: 'text-ams-success',
      bgColor: 'bg-ams-success/10',
      link: '/athletes',
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
      <div className="ams-card p-6">
        <h2 className="text-2xl font-bold text-ams-text-primary mb-2">
          欢迎{user ? `，${user.name}` : ''}
        </h2>
        <p className="text-ams-text-secondary">
          {user?.role === 'COACH' ? '教练员' : user?.role === 'MEDICAL' ? '医研人员' : user?.role === 'ADMIN' ? '管理员' : ''}
          ，今天是管理团队的一天。以下是当前系统概览。
        </p>
      </div>

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