import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const icon = (paths: ReactNode) => (props: IconProps) => <Svg {...props}>{paths}</Svg>;

export const SearchIcon = icon(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const FilterIcon = icon(<path d="M4 6h16M7 12h10M10 18h4" />);
export const CloseIcon = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const BackIcon = icon(<path d="m15 18-6-6 6-6" />);
export const NextIcon = icon(<path d="m9 18 6-6-6-6" />);
export const GridIcon = icon(<><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /></>);
export const HeartIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.8 4.5 7.2 4.5c2 0 3.6 1 4.8 2.8 1.2-1.8 2.8-2.8 4.8-2.8 3.4 0 5.6 3.2 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z" />
  </Svg>
);
export const CameraIcon = icon(<><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-2h6l1.2 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" /><circle cx="12" cy="12.5" r="3.5" /></>);
export const SettingsIcon = icon(<><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>);
export const SparkleIcon = ({ filled, ...props }: IconProps & { filled?: boolean }) => (
  <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2Z" />
    <path d="M19 3v3M20.5 4.5h-3" />
  </Svg>
);
export const SpeakerIcon = icon(<><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>);
export const RepeatIcon = icon(<><path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 11V9a3 3 0 0 1 3-3h14" /><path d="M7 21.5 3.5 18 7 14.5" /><path d="M20.5 13v2a3 3 0 0 1-3 3h-14" /></>);
export const StopIcon = icon(<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" />);
export const UploadIcon = icon(<><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" /></>);
export const SwitchCameraIcon = icon(<><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.2-2h6l1.2 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" /><path d="m9 12 1.8-1.8M9 12l1.8 1.8M15 12l-1.8 1.8M15 12l-1.8-1.8M9 12h6" /></>);
export const LiveIcon = icon(<><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.5 4.5a10.6 10.6 0 0 0 0 15M19.5 4.5a10.6 10.6 0 0 1 0 15" /></>);
export const InfoIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>);
export const AlertIcon = icon(<><path d="M12 4 2.8 19.5h18.4Z" /><path d="M12 10v4.5M12 17h.01" /></>);
export const CheckIcon = icon(<path d="m5 12.5 4.5 4.5L19 7" />);
export const LockIcon = icon(<><rect x="5" y="11" width="14" height="9.5" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>);
export const ArrowRightIcon = icon(<path d="M5 12h14M13 6l6 6-6 6" />);
