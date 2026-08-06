'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AthleteForm, AthleteFormData } from '@/components/athletes/AthleteForm';
import { Button } from '@/components/ui/button';
import { Gender, AthleteStatus } from '@/types';

export default function NewAthletePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (data: AthleteFormData) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          height: data.height ? parseFloat(data.height) : null,
          weight: data.weight ? parseFloat(data.weight) : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/athletes/${json.data.id}`);
      } else {
        setError(json.error || '创建失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/athletes">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-ams-text-primary">新建运动员</h2>
      </div>

      {error && (
        <div className="rounded-ams border border-ams-danger/30 bg-ams-danger/10 px-4 py-3 text-sm text-ams-danger">
          {error}
        </div>
      )}

      <div className="ams-card p-6">
        <AthleteForm
          isLoading={isLoading}
          onSubmit={handleSubmit}
          initialData={{
            gender: Gender.MALE,
            status: AthleteStatus.ACTIVE,
            joinDate: new Date().toISOString().split('T')[0],
          }}
        />
      </div>
    </div>
  );
}