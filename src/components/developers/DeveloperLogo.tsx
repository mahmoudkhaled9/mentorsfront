import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Developer logo; falls back to an icon when there is no logo or the image cannot be loaded (404, offline). */
export function DeveloperLogo({ src, name, className, iconClassName }: { src?: string; name: string; className?: string; iconClassName?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Building2 aria-label={`${name} (no logo)`} className={cn('h-16 w-16 text-gray-400', iconClassName)} />;
  return <img src={src} alt={name} loading="lazy" className={className} onError={() => setFailed(true)} />;
}
