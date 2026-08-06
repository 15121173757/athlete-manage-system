'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, UploadCloud, AlertTriangle } from 'lucide-react';

/** 文件大小上限：5MB（与后端一致） */
const MAX_SIZE = 5 * 1024 * 1024;
/** 仅允许 JPG / PNG */
const ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';

interface AthleteAvatarProps {
  athleteId: number;
  athleteName: string;
  photoUrl: string | null;
  /** 上传成功回调（携带新照片 URL） */
  onUpdated?: (photoUrl: string) => void;
}

/**
 * 运动员头像组件：支持点击选择与拖放上传，前后端双重校验（JPG/PNG、≤5MB），移动端适配。
 */
export default function AthleteAvatar({ athleteId, athleteName, photoUrl, onUpdated }: AthleteAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');

  /** 前端预校验（与后端一致） */
  const validate = (file: File): string | null => {
    if (!/^image\/(jpeg|png)$/.test(file.type)) return '仅支持 JPG / PNG 格式的图片';
    if (!/\.(jpe?g|png)$/i.test(file.name)) return '仅支持 .jpg / .jpeg / .png 文件';
    if (file.size > MAX_SIZE) return '图片大小不能超过 5MB';
    return null;
  };

  /** 读取文件头魔数，确认真实为 JPG/PNG（与服务端校验一致） */
  const checkMagic = async (file: File): Promise<boolean> => {
    try {
      const buf = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng =
        buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
      return isJpeg || isPng;
    } catch {
      return false;
    }
  };

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    setError('');
    const errMsg = validate(file);
    if (errMsg) {
      setError(errMsg);
      return;
    }
    if (!(await checkMagic(file))) {
      setError('文件内容不是有效的 JPG/PNG 图片');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/athletes/${athleteId}/photo`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || json.message || '上传失败');
      }
      onUpdated?.(json.data.photoUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="group relative">
      {/* 头像容器：点击选择 / 拖放上传 */}
      <div
        role="button"
        aria-label="上传头像"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files?.[0]);
        }}
        className={`relative flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 transition-colors select-none ${
          dragOver
            ? 'border-ams-primary bg-ams-primary/10'
            : 'border-ams-border group-hover:border-ams-primary/60'
        } ${photoUrl ? '' : 'bg-ams-primary/20'}`}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={athleteName} className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl font-bold text-ams-primary">{athleteName.charAt(0)}</span>
        )}

        {/* 桌面端悬停遮罩 */}
        <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/55 text-xs text-white transition-opacity md:flex md:opacity-0 md:group-hover:opacity-100">
          <UploadCloud className="h-4 w-4" />
          更换头像
        </div>

        {/* 拖放高亮提示 */}
        {dragOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-ams-primary/30 text-xs font-medium text-white">
            <UploadCloud className="h-4 w-4" />
            松开以上传
          </div>
        )}

        {/* 上传中 */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>

      {/* 移动端编辑角标（触屏无 hover，常显便于操作） */}
      <button
        type="button"
        aria-label="更换头像"
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-ams-border bg-ams-surface text-ams-text-primary shadow-ams-card transition-colors hover:bg-ams-surface-hover md:hidden"
      >
        <Camera className="h-3.5 w-3.5" />
      </button>

      {/* 错误提示 */}
      {error && (
        <div className="absolute left-1/2 top-28 flex w-max max-w-[200px] -translate-x-1/2 items-start gap-1 rounded-ams bg-ams-danger/10 px-2 py-1 text-xs text-ams-danger">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
