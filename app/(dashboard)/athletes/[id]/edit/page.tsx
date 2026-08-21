'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AthleteForm, AthleteFormData } from '@/components/athletes/AthleteForm';
import { Button } from '@/components/ui/button';

interface Athlete {
  id: number;
  name: string;
  gender: string;
  birthDate: string;
  height: number | null;
  weight: number | null;
  sport: string;
  position: string | null;
  joinDate: string;
}

export default function EditAthletePage() {
  const params = useParams();
  const router = useRouter();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
          setError(json.error?.message || '加载失败');
        }
      } catch {
        setError('网络错误');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAthlete();
  }, [params.id]);

  const handleSubmit = async (data: AthleteFormData) => {
    setIsSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/athletes/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          height: data.height ? parseFloat(data.height) : null,
          weight: data.weight ? parseFloat(data.weight) : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/athletes/${params.id}`);
      } else {
        setError(json.error?.message || '更新失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-ams-text-secondary">加载中...</div>;
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

  const initialData: Partial<AthleteFormData> = {
    name: athlete.name,
    gender: athlete.gender as any,
    birthDate: athlete.birthDate.split('T')[0],
    height: athlete.height ? String(athlete.height) : '',
    weight: athlete.weight ? String(athlete.weight) : '',
    sport: athlete.sport,
    position: athlete.position || '',
    joinDate: athlete.joinDate.split('T')[0],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/athletes/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回详情
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-ams-text-primary">编辑运动员</h2>
      </div>

      {error && (
        <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
          {error}
        </div>
      )}

      <div className="ams-card p-6">
        <AthleteForm
          isLoading={isSaving}
          onSubmit={handleSubmit}
          initialData={initialData}
        />
      </div>
    </div>
  );
}