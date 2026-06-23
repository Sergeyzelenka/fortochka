// Лого-связка: SVG-знак «Ф» + текст «ОРТОЧКА» с ровным трекингом.
// size — высота знака в пикселях, текст подстраивается пропорционально.
// tone:
//   'auto' (по умолчанию) — цвет наследуется от родителя через currentColor;
//                           подхватывает текущую тему сайта (светлая/тёмная).
//   'dark'  — принудительно тёмные линии (для светлого фона).
//   'light' — принудительно светлые линии (для тёмного фона, напр. админка).

interface BrandProps {
  size?: number;
  tone?: 'auto' | 'dark' | 'light';
  className?: string;
}

export default function Brand({ size = 40, tone = 'auto', className = '' }: BrandProps) {
  const ink =
    tone === 'dark' ? '#15171C' :
    tone === 'light' ? '#FAFAF7' :
    'currentColor';
  return (
    <span
      className={`brand-lockup ${className}`}
      style={{ ['--brand-size' as any]: `${size}px` }}
      aria-label="ФОРТОЧКА"
    >
      <svg className="brand-mark" viewBox="0 0 100 100" role="img" aria-hidden="true">
        <path d="M50,20 L64,20 A16,16 0 0 1 80,36 L80,42 L50,42 Z" fill="#F2B22D" />
        <rect x="20" y="20" width="60" height="60" rx="16" fill="none" stroke={ink} strokeWidth="8.5" />
        <line x1="50" y1="6" x2="50" y2="94" stroke={ink} strokeWidth="8.5" strokeLinecap="round" />
        <line x1="50" y1="42" x2="80" y2="42" stroke={ink} strokeWidth="8.5" />
      </svg>
      <span className="brand-text" style={{ color: ink }}>ОРТОЧКА</span>
    </span>
  );
}
