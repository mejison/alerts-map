type ThreatIconProps = {
  type: string;
  size?: number;
  className?: string;
};

/** Shared silhouettes: the same geometry is used in the UI and map markers.
 * All glyphs face north; only a supplied, trusted heading rotates map glyphs.
 */
export function ThreatGlyph({type}: {type: string}) {
  if (type === 'missile' || type === 'ballistic') {
    return <g fill="currentColor">
      <path d="M0-11C1.7-9.3 2.5-6.8 2.5-4V1.5L5.5 5.5V8L2 6.5V9H-2V6.5L-5.5 8V5.5L-2.5 1.5V-4C-2.5-6.8-1.7-9.3 0-11Z"/>
      <path d="M-1.3 10H1.3L0 12Z" opacity=".55"/>
      <path d="M-1.5-4H1.5" stroke="var(--map)" strokeWidth="1" opacity=".55"/>
    </g>;
  }
  if (type === 'fpv') {
    return <g stroke="currentColor" strokeWidth="1.7" fill="none">
      <path d="M-6-6 6 6M6-6-6 6" strokeLinecap="round"/>
      <circle cx="-7" cy="-7" r="3.5"/><circle cx="7" cy="-7" r="3.5"/>
      <circle cx="-7" cy="7" r="3.5"/><circle cx="7" cy="7" r="3.5"/>
      <rect x="-2" y="-3" width="4" height="6" rx="1" fill="currentColor"/>
    </g>;
  }
  if (type === 'mig31k') {
    return <path fill="currentColor" d="M0-11 2-7 2-2 10 4V6L2 3V7L5 9V11L0 9-5 11V9L-2 7V3L-10 6V4L-2-2V-7Z"/>;
  }
  if (type === 'kab') {
    return <g fill="currentColor"><path d="M-3-9-6-11V-5L-3-3H3L6-5V-11L3-9ZM-3-2H3C7 2 5 9 0 11-5 9-7 2-3-2Z"/></g>;
  }
  if (type === 'uav') {
    // Delta wing and projecting nose, matching the supplied UAV silhouette.
    return <path fill="currentColor" d="M0-11.5C1-10.5 1.6-8.9 1.6-6.5V-4.8L10.4 7.4 8.9 9.2H-8.9L-10.4 7.4-1.6-4.8V-6.5C-1.6-8.9-1-10.5 0-11.5Z"/>;
  }
  if (type === 'recon') {
    return <g fill="currentColor">
      <path d="M0-10.5 2-4 10.7 6.4Q11.2 7 10.4 6.8L2.3 3.6 1.8 7.3 3.8 9.5H-3.8L-1.8 7.3-2.3 3.6-10.4 6.8Q-11.2 7-10.7 6.4L-2-4Z"/>
      <path d="M0-6V6.5" stroke="var(--map)" strokeWidth=".9" opacity=".45"/>
    </g>;
  }
  return <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
    <circle r="9"/><path d="M-2.5-3A2.7 2.7 0 0 1 2.7-2C2.7 0 0 0 0 2"/><circle cy="5.5" r=".7" fill="currentColor" stroke="none"/>
  </g>;
}

export function ThreatIcon({type,size=18,className}: ThreatIconProps) {
  return <svg width={size} height={size} viewBox="-12 -12 24 24" className={className} aria-hidden="true" focusable="false"><ThreatGlyph type={type}/></svg>;
}
