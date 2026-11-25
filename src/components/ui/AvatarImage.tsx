import { useEffect, useState } from 'react';
import { fetchProtectedImageUrl } from '../../services/api';
import { getInitials } from '../../utils/pureFormatters';

interface AvatarImageProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-14 h-14 text-sm',
  xl: 'w-20 h-20 text-lg',
};

export function AvatarImage({ src, name, size = 'md', className = '' }: AvatarImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setFailed(false);

    if (!src) {
      setResolvedSrc(null);
      return;
    }

    if (src.startsWith('/api/files/')) {
      fetchProtectedImageUrl(src)
        .then((url) => {
          if (!active) {
            if (url) URL.revokeObjectURL(url);
            return;
          }
          objectUrl = url;
          setResolvedSrc(url);
          if (!url) setFailed(true);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    } else {
      setResolvedSrc(src);
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const sizeClass = SIZE_CLASSES[size];

  if (!resolvedSrc || failed) {
    return (
      <div
        aria-label={name}
        className={`${sizeClass} rounded-full shrink-0 flex items-center justify-center font-semibold tracking-tight bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300/70 dark:border-slate-700 select-none ${className}`}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full shrink-0 object-cover border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 ${className}`}
    />
  );
}
