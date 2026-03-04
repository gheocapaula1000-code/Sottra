const SottraLogoSvg = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Reticle circle */}
    <circle cx="100" cy="100" r="75" stroke="#9CA3AF" strokeWidth="2.5" opacity="0.7" />

    {/* Crosshair lines */}
    <line x1="100" y1="10" x2="100" y2="22" stroke="#9CA3AF" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />
    <line x1="100" y1="178" x2="100" y2="190" stroke="#9CA3AF" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />
    <line x1="10" y1="100" x2="22" y2="100" stroke="#9CA3AF" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />
    <line x1="178" y1="100" x2="190" y2="100" stroke="#9CA3AF" strokeWidth="2.5" opacity="0.7" strokeLinecap="round" />

    {/* Letter S */}
    <text
      x="100"
      y="112"
      textAnchor="middle"
      dominantBaseline="central"
      fill="white"
      fontSize="110"
      fontWeight="800"
      fontFamily="system-ui, -apple-system, sans-serif"
    >
      S
    </text>

    {/* Scan line - blue glow */}
    <defs>
      <linearGradient id="scanGlow" x1="30" y1="0" x2="170" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
        <stop offset="20%" stopColor="#3B82F6" stopOpacity="0.6" />
        <stop offset="50%" stopColor="#93C5FD" stopOpacity="1" />
        <stop offset="80%" stopColor="#3B82F6" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="scanGlowWide" x1="30" y1="0" x2="170" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
        <stop offset="30%" stopColor="#3B82F6" stopOpacity="0.3" />
        <stop offset="50%" stopColor="#60A5FA" stopOpacity="0.5" />
        <stop offset="70%" stopColor="#3B82F6" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* Wide glow */}
    <rect x="30" y="118" width="140" height="8" fill="url(#scanGlowWide)" rx="4" />
    {/* Core line */}
    <rect x="35" y="120" width="130" height="4" fill="url(#scanGlow)" rx="2" />
    {/* Bright center */}
    <rect x="55" y="121" width="90" height="2" fill="white" opacity="0.6" rx="1" />

    {/* Dissolving pixels below scan line */}
    {/* Row 1 - closest to scan line, most opaque */}
    <rect x="60" y="128" width="6" height="6" fill="#3B82F6" opacity="0.9" />
    <rect x="72" y="130" width="5" height="5" fill="#93C5FD" opacity="0.85" />
    <rect x="85" y="127" width="7" height="7" fill="#3B82F6" opacity="0.9" />
    <rect x="98" y="129" width="5" height="5" fill="white" opacity="0.8" />
    <rect x="110" y="128" width="6" height="6" fill="#3B82F6" opacity="0.85" />
    <rect x="122" y="130" width="5" height="5" fill="#60A5FA" opacity="0.9" />
    <rect x="133" y="127" width="6" height="6" fill="#3B82F6" opacity="0.8" />

    {/* Row 2 */}
    <rect x="55" y="138" width="5" height="5" fill="#3B82F6" opacity="0.7" />
    <rect x="68" y="140" width="4" height="4" fill="#60A5FA" opacity="0.65" />
    <rect x="80" y="137" width="6" height="6" fill="#3B82F6" opacity="0.7" />
    <rect x="93" y="139" width="4" height="4" fill="white" opacity="0.6" />
    <rect x="105" y="138" width="5" height="5" fill="#3B82F6" opacity="0.7" />
    <rect x="116" y="140" width="4" height="4" fill="#93C5FD" opacity="0.65" />
    <rect x="128" y="137" width="5" height="5" fill="#3B82F6" opacity="0.6" />
    <rect x="139" y="139" width="4" height="4" fill="#60A5FA" opacity="0.55" />

    {/* Row 3 */}
    <rect x="63" y="148" width="4" height="4" fill="#3B82F6" opacity="0.5" />
    <rect x="78" y="150" width="3" height="3" fill="#60A5FA" opacity="0.45" />
    <rect x="90" y="147" width="5" height="5" fill="#3B82F6" opacity="0.5" />
    <rect x="104" y="149" width="4" height="4" fill="#3B82F6" opacity="0.45" />
    <rect x="118" y="148" width="3" height="3" fill="white" opacity="0.4" />
    <rect x="130" y="150" width="4" height="4" fill="#3B82F6" opacity="0.4" />

    {/* Row 4 - farthest, most faded */}
    <rect x="70" y="158" width="3" height="3" fill="#3B82F6" opacity="0.3" />
    <rect x="88" y="160" width="3" height="3" fill="#60A5FA" opacity="0.25" />
    <rect x="102" y="157" width="4" height="4" fill="#3B82F6" opacity="0.3" />
    <rect x="120" y="159" width="3" height="3" fill="#3B82F6" opacity="0.2" />

    {/* Row 5 - barely visible */}
    <rect x="82" y="167" width="3" height="3" fill="#3B82F6" opacity="0.15" />
    <rect x="110" y="168" width="2" height="2" fill="#60A5FA" opacity="0.15" />
  </svg>
);

export default SottraLogoSvg;
