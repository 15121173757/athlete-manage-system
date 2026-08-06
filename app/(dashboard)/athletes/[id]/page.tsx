'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, Trash2, Dumbbell, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Gender, AthleteStatus } from '@/types';
import AthleteAvatar from '../components/AthleteAvatar';

interface Athlete {
  id: number;
  name: string;
  gender: Gender;
  birthDate: string;
  height: number | null;
  weight: number | null;
  sport: string;
  position: string | null;
  joinDate: string;
  status: AthleteStatus;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '在队', color: 'text-ams-success' },
  RECOVERING: { label: '休养', color: 'text-ams-warning' },
  LEFT: { label: '离队', color: 'text-ams-text-muted' },
};

export default function AthleteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAthlete = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/athletes/${params.id}`);
        const json = await res.json();
        if (json.success) {
          setAthlete(json.data);
        } else {
          setError(json.error || '加载失败');
        }
      } catch {
        setError('网络错误');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAthlete();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('确定要删除该运动员吗？此操作不可撤销。')) return;
    try {
      const res = await fetch(`/api/athletes/${params.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        router.push('/athletes');
      } else {
        alert(json.error || '删除失败');
      }
    } catch {
      alert('网络错误');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-ams-text-secondary">加载中...</div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="space-y-4">
        <Link href="/athletes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
        <div className="ams-card p-8 text-center text-ams-danger">
          {error || '未找到该运动员'}
        </div>
      </div>
    );
  }

  const s = statusLabels[athlete.status] || { label: athlete.status, color: 'text-ams-text-secondary' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/athletes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Button>
          </Link>
          <h2 className="text-xl font-semibold text-ams-text-primary">运动员详情</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.open(`/api/athletes/export?format=pdf&athleteId=${athlete.id}`, '_blank')}>
            <FileText className="h-4 w-4" />
            导出PDF
          </Button>
          <Link href={`/athletes/${athlete.id}/edit`}>
            <Button variant="outline">
              <Edit2 className="h-4 w-4" />
              编辑
            </Button>
          </Link>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      <div className="ams-card p-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <AthleteAvatar
            athleteId={athlete.id}
            athleteName={athlete.name}
            photoUrl={athlete.photoUrl}
            onUpdated={(url) => setAthlete((prev) => (prev ? { ...prev, photoUrl: url } : prev))}
          />
          <div className="w-full flex-1 text-center md:text-left">
            <div className="mb-4 flex items-center justify-center gap-3 md:justify-start">
              <h3 className="text-2xl font-bold text-ams-text-primary">{athlete.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.color} bg-ams-surface-hover`}>
                {s.label}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3">
              <div>
                <div className="ams-table-header mb-1">性别</div>
                <div className="text-ams-text-primary">{genderLabels[athlete.gender] || athlete.gender}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">出生日期</div>
                <div className="text-ams-text-primary">{new Date(athlete.birthDate).toLocaleDateString('zh-CN')}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">身高</div>
                <div className="text-ams-text-primary">{athlete.height ? `${athlete.height} cm` : '-'}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">体重</div>
                <div className="text-ams-text-primary">{athlete.weight ? `${athlete.weight} kg` : '-'}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">项目</div>
                <div className="text-ams-text-primary">{athlete.sport}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">位置</div>
                <div className="text-ams-text-primary">{athlete.position || '-'}</div>
              </div>
              <div>
                <div className="ams-table-header mb-1">入队日期</div>
                <div className="text-ams-text-primary">{new Date(athlete.joinDate).toLocaleDateString('zh-CN')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="ams-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="h-5 w-5 text-ams-primary" />
            <span className="text-ams-text-primary font-medium">训练计划</span>
          </div>
          <p className="text-2xl font-bold text-ams-text-primary">-</p>
          <p className="text-xs text-ams-text-muted mt-1">查看该运动员的训练计划</p>
        </div>
        <div className="ams-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="h-5 w-5 text-ams-success" />
            <span className="text-ams-text-primary font-medium">训练记录</span>
          </div>
          <p className="text-2xl font-bold text-ams-text-primary">-</p>
          <p className="text-xs text-ams-text-muted mt-1">查看该运动员的训练历史</p>
        </div>
        <div className="ams-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="h-5 w-5 text-ams-warning" />
            <span className="text-ams-text-primary font-medium">PB纪录</span>
          </div>
          <p className="text-2xl font-bold text-ams-text-primary">-</p>
          <p className="text-xs text-ams-text-muted mt-1">查看该运动员的个人最好纪录</p>
        </div>
      </div>
    </div>
  );
}