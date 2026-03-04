const SottraLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="scanLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
        <stop offset="30%" stopColor="#3B82F6" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
        <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Crosshair lines */}
    <line x1="60" y1="4" x2="60" y2="20" stroke="#C0C8D8" strokeWidth="2" />
    <line x1="60" y1="100" x2="60" y2="116" stroke="#C0C8D8" strokeWidth="2" />
    <line x1="4" y1="60" x2="20" y2="60" stroke="#C0C8D8" strokeWidth="2" />
    <line x1="100" y1="60" x2="116" y2="60" stroke="#C0C8D8" strokeWidth="2" />

    {/* Crosshair circle */}
    <circle cx="60" cy="60" r="40" stroke="#C0C8D8" strokeWidth="2" />

    {/* Letter S */}
    <text
      x="60" y="68"
      textAnchor="middle"
      dominantBaseline="central"
      fill="white"
      fontSize="52"
      fontWeight="800"
      fontFamily="Inter, system-ui, sans-serif"
    >
      S
    </text>

    {/* Scan line */}
    <rect x="15" y="72" width="90" height="2.5" rx="1.25" fill="url(#scanLine)" />

    {/* Pixel dissolve effect below scan line */}
    {/* Row 1 */}
    <rect x="38" y="79" width="4" height="4" rx="0.5" fill="#3B82F6" opacity="0.7" />
    <rect x="46" y="79" width="4" height="4" rx="0.5" fill="white" opacity="0.5" />
    <rect x="54" y="79" width="4" height="4" rx="0.5" fill="#3B82F6" opacity="0.6" />
    <rect x="62" y="79" width="4" height="4" rx="0.5" fill="white" opacity="0.45" />
    <rect x="70" y="79" width="4" height="4" rx="0.5" fill="#3B82F6" opacity="0.55" />
    <rect x="78" y="79" width="4" height="4" rx="0.5" fill="white" opacity="0.4" />

    {/* Row 2 */}
    <rect x="42" y="86" width="3.5" height="3.5" rx="0.5" fill="#3B82F6" opacity="0.45" />
    <rect x="50" y="86" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.35" />
    <rect x="58" y="86" width="3.5" height="3.5" rx="0.5" fill="#3B82F6" opacity="0.4" />
    <rect x="66" y="86" width="3.5" height="3.5" rx="0.5" fill="white" opacity="0.3" />
    <rect x="74" y="86" width="3.5" height="3.5" rx="0.5" fill="#3B82F6" opacity="0.35" />

    {/* Row 3 */}
    <rect x="46" y="92" width="3" height="3" rx="0.5" fill="#3B82F6" opacity="0.25" />
    <rect x="55" y="92" width="3" height="3" rx="0.5" fill="white" opacity="0.2" />
    <rect x="64" y="92" width="3" height="3" rx="0.5" fill="#3B82F6" opacity="0.2" />
    <rect x="72" y="92" width="3" height="3" rx="0.5" fill="white" opacity="0.15" />

    {/* Row 4 */}
    <rect x="52" y="97" width="2.5" height="2.5" rx="0.5" fill="#3B82F6" opacity="0.12" />
    <rect x="61" y="97" width="2.5" height="2.5" rx="0.5" fill="white" opacity="0.1" />
    <rect x="69" y="97" width="2.5" height="2.5" rx="0.5" fill="#3B82F6" opacity="0.08" />
  </svg>
);

export default SottraLogo;
