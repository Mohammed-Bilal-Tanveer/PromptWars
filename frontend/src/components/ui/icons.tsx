import type { ReactNode, SVGProps } from 'react'

/**
 * LabLink icon set — simple 24×24 outline icons, 1.5px stroke, `currentColor`.
 * Decorative by default (aria-hidden); pair them with visible text or an aria-label on the parent.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function make(name: string, paths: ReactNode) {
  const C = ({ size = 20, className, strokeWidth = 1.5, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {paths}
    </svg>
  )
  C.displayName = `Icon${name}`
  return C
}

export const IconHome = make('Home', <><path d="M3.5 10.5 12 4l8.5 6.5" /><path d="M5.5 9v10.5h13V9" /><path d="M10 19.5v-5h4v5" /></>)
export const IconSearch = make('Search', <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></>)
export const IconFlask = make('Flask', <><path d="M9.5 3.5h5" /><path d="M10.5 3.5v5.2L5 18.2A1.5 1.5 0 0 0 6.3 20.5h11.4a1.5 1.5 0 0 0 1.3-2.3l-5.5-9.5V3.5" /><path d="M7.5 14.5h9" /></>)
export const IconCalendar = make('Calendar', <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>)
export const IconClipboard = make('Clipboard', <><rect x="5" y="4.5" width="14" height="16" rx="2" /><path d="M9 4.5V3.5h6v1" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>)
export const IconSliders = make('Sliders', <><path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" /><circle cx="15" cy="6.5" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17.5" r="2" /></>)
export const IconCheckSquare = make('CheckSquare', <><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /><path d="m8 12.2 2.8 2.8L16.2 9.5" /></>)
export const IconChart = make('Chart', <><path d="M4 4v16h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>)
export const IconBuilding = make('Building', <><path d="M4 20.5h16" /><path d="M5.5 20.5V9.5L12 5l6.5 4.5v11" /><path d="M9 20.5v-4h6v4M9 12h.01M12 12h.01M15 12h.01" /></>)
export const IconMessage = make('Message', <><path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.3-4.6A7.5 7.5 0 1 1 20 12.5Z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></>)
export const IconCube = make('Cube', <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>)
export const IconBell = make('Bell', <><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>)
export const IconListChecks = make('ListChecks', <><path d="m4 6.5 1.5 1.5L8 5.5M4 12.5 5.5 14 8 11.5M4 18.5 5.5 20 8 17.5" /><path d="M11 7h9M11 13h9M11 19h9" /></>)
export const IconMenu = make('Menu', <path d="M4 6.5h16M4 12h16M4 17.5h16" />)
export const IconX = make('X', <path d="M6 6l12 12M18 6 6 18" />)
export const IconArrowRight = make('ArrowRight', <path d="M5 12h14M13 6l6 6-6 6" />)
export const IconArrowLeft = make('ArrowLeft', <path d="M19 12H5M11 6l-6 6 6 6" />)
export const IconChevronRight = make('ChevronRight', <path d="m9 6 6 6-6 6" />)
export const IconChevronLeft = make('ChevronLeft', <path d="m15 6-6 6 6 6" />)
export const IconChevronDown = make('ChevronDown', <path d="m6 9 6 6 6-6" />)
export const IconAlert = make('Alert', <><path d="M12 4 2.8 19.5h18.4L12 4Z" /><path d="M12 10v4.5M12 17.2h.01" /></>)
export const IconInfo = make('Info', <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8h.01" /></>)
export const IconCheck = make('Check', <path d="m5 12.5 4.5 4.5L19 7.5" />)
export const IconCheckCircle = make('CheckCircle', <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.3 2.4 2.4 4.6-4.9" /></>)
export const IconXCircle = make('XCircle', <><circle cx="12" cy="12" r="8.5" /><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" /></>)
export const IconClock = make('Clock', <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>)
export const IconWrench = make('Wrench', <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.8 8.8a2 2 0 0 1-2.9-2.9l8.8-8.8a4 4 0 0 0-2.1-2.1Zm0 0a4 4 0 0 1 5-3l-2.5 2.5.5 2 2 .5 2.5-2.5" />)
export const IconEye = make('Eye', <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>)
export const IconInbox = make('Inbox', <><path d="M3.5 13.5 6 5.5h12l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-5Z" /><path d="M3.5 13.5H8l1.5 2.5h5l1.5-2.5h4.5" /></>)
export const IconMapPin = make('MapPin', <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" /><circle cx="12" cy="10" r="2.3" /></>)
export const IconUsers = make('Users', <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M16 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2a5.5 5.5 0 0 1 3 5.3" /></>)
export const IconCpu = make('Cpu', <><rect x="6" y="6" width="12" height="12" rx="1.5" /><rect x="9.5" y="9.5" width="5" height="5" /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" /></>)
export const IconLayers = make('Layers', <><path d="m12 3.5 9 4.8-9 4.7-9-4.7 9-4.8Z" /><path d="m3 12.5 9 4.7 9-4.7M3 16.5l9 4.7 9-4.7" /></>)
export const IconPlus = make('Plus', <path d="M12 5v14M5 12h14" />)
export const IconFilter = make('Filter', <path d="M4 5.5h16l-6.2 7.3v5.7l-3.6 1.8v-7.5L4 5.5Z" />)
export const IconRefresh = make('Refresh', <><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5" /><path d="M4.5 12a7.5 7.5 0 0 1 13.1-5" /><path d="M17.8 3.5v3.7h-3.7M6.2 20.5v-3.7h3.7" /></>)
export const IconSend = make('Send', <><path d="M20.5 3.5 10 14" /><path d="m20.5 3.5-6.5 17-4-6.5-6.5-4 17-6.5Z" /></>)
export const IconGauge = make('Gauge', <><path d="M4.2 17.5a8.5 8.5 0 1 1 15.6 0" /><path d="m12 13 3.5-4" /><circle cx="12" cy="13" r="1.2" /></>)
export const IconMap = make('Map', <><path d="m9 4.5-5.5 2v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z" /><path d="M9 4.5v13M15 6.5v13" /></>)
export const IconKeyboard = make('Keyboard', <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9" /></>)
export const IconLock = make('Lock', <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>)
export const IconPlay = make('Play', <path d="M7.5 5v14l11-7-11-7Z" />)
export const IconLogout = make('Logout', <><path d="M14 4.5h4.5a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" /></>)
export const IconExternal = make('External', <><path d="M13.5 4.5h6v6M19.5 4.5 11 13" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></>)
export const IconSwap = make('Swap', <path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13" />)
export const IconMinus = make('Minus', <path d="M6 12h12" />)
export const IconDot = make('Dot', <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />)
export const IconLightbulb = make('Lightbulb', <><path d="M9 17.5h6M10 20.5h4" /><path d="M8.5 14.5a6 6 0 1 1 7 0c-.6.5-1 1.2-1 2v1h-5v-1c0-.8-.4-1.5-1-2Z" /></>)
export const IconHelp = make('Help', <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9.5a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.4M12 16.8h.01" /></>)
