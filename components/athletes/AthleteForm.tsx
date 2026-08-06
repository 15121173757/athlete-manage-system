'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Gender, AthleteStatus } from '@/types';

export interface AthleteFormData {
  name: string;
  gender: Gender;
  birthDate: string;
  height: string;
  weight: string;
  sport: string;
  position: string;
  joinDate: string;
  status: AthleteStatus;
}

interface AthleteFormProps {
  initialData?: Partial<AthleteFormData>;
  onSubmit: (data: AthleteFormData) => Promise<void> | void;
  isLoading?: boolean;
}

const defaultData: AthleteFormData = {
  name: '',
  gender: Gender.MALE,
  birthDate: '',
  height: '',
  weight: '',
  sport: '',
  position: '',
  joinDate: new Date().toISOString().split('T')[0],
  status: AthleteStatus.ACTIVE,
};

export function AthleteForm({ initialData, onSubmit, isLoading }: AthleteFormProps) {
  const [form, setForm] = useState<AthleteFormData>({ ...defaultData, ...initialData });
  const [errors, setErrors] = useState<Partial<Record<keyof AthleteFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setForm((prev) => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleChange = (field: keyof AthleteFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AthleteFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = '请输入姓名';
    if (!form.gender) newErrors.gender = '请选择性别';
    if (!form.birthDate) newErrors.birthDate = '请选择出生日期';
    if (!form.sport.trim()) newErrors.sport = '请输入项目';
    if (!form.joinDate) newErrors.joinDate = '请选择入队日期';
    if (form.height && isNaN(Number(form.height))) newErrors.height = '身高必须是数字';
    if (form.weight && isNaN(Number(form.weight))) newErrors.weight = '体重必须是数字';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(form);
  };

  const inputClass =
    'w-full rounded-ams bg-ams-background border border-ams-border px-3 py-2 text-sm text-ams-text-primary placeholder:text-ams-text-muted focus:border-ams-primary focus:outline-none focus:ring-1 focus:ring-ams-primary';
  const labelClass = 'block text-sm font-medium text-ams-text-primary mb-1.5';
  const errorClass = 'mt-1 text-xs text-ams-danger';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>姓名 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className={inputClass}
            placeholder="请输入姓名"
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <label className={labelClass}>性别 *</label>
          <select
            value={form.gender}
            onChange={(e) => handleChange('gender', e.target.value as Gender)}
            className={inputClass}
          >
            <option value={Gender.MALE}>男</option>
            <option value={Gender.FEMALE}>女</option>
          </select>
          {errors.gender && <p className={errorClass}>{errors.gender}</p>}
        </div>

        <div>
          <label className={labelClass}>出生日期 *</label>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => handleChange('birthDate', e.target.value)}
            className={inputClass}
          />
          {errors.birthDate && <p className={errorClass}>{errors.birthDate}</p>}
        </div>

        <div>
          <label className={labelClass}>身高 (cm)</label>
          <input
            type="number"
            value={form.height}
            onChange={(e) => handleChange('height', e.target.value)}
            className={inputClass}
            placeholder="例如 180"
          />
          {errors.height && <p className={errorClass}>{errors.height}</p>}
        </div>

        <div>
          <label className={labelClass}>体重 (kg)</label>
          <input
            type="number"
            value={form.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            className={inputClass}
            placeholder="例如 75"
          />
          {errors.weight && <p className={errorClass}>{errors.weight}</p>}
        </div>

        <div>
          <label className={labelClass}>项目 *</label>
          <input
            type="text"
            value={form.sport}
            onChange={(e) => handleChange('sport', e.target.value)}
            className={inputClass}
            placeholder="例如 田径、篮球"
          />
          {errors.sport && <p className={errorClass}>{errors.sport}</p>}
        </div>

        <div>
          <label className={labelClass}>位置</label>
          <input
            type="text"
            value={form.position}
            onChange={(e) => handleChange('position', e.target.value)}
            className={inputClass}
            placeholder="例如 前锋、守门员"
          />
        </div>

        <div>
          <label className={labelClass}>入队日期 *</label>
          <input
            type="date"
            value={form.joinDate}
            onChange={(e) => handleChange('joinDate', e.target.value)}
            className={inputClass}
          />
          {errors.joinDate && <p className={errorClass}>{errors.joinDate}</p>}
        </div>

        <div>
          <label className={labelClass}>状态</label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value as AthleteStatus)}
            className={inputClass}
          >
            <option value={AthleteStatus.ACTIVE}>在队</option>
            <option value={AthleteStatus.RECOVERING}>休养</option>
            <option value={AthleteStatus.LEFT}>离队</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
      </div>
    </form>
  );
}