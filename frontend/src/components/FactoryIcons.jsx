import React from 'react';

// A shared 24px stroke grid keeps factory symbols consistent with action icons.
const symbols = {
  plant: (
    <>
      <path d="M3 21V10l6 3V9l6 3V5h4l2 16H3Z" />
      <path d="M6 17h2m3 0h2m3 0h2M16 5V2h2v3" />
    </>
  ),
  conveyor: (
    <>
      <rect x="2" y="13" width="20" height="6" rx="3" />
      <circle cx="6" cy="16" r=".7" />
      <circle cx="12" cy="16" r=".7" />
      <circle cx="18" cy="16" r=".7" />
      <path d="M5 19v3m14-3v3M5 13V6h6v7m3 0V8h5v5M5 9h6" />
    </>
  ),
  press: (
    <>
      <path d="M4 22V3h16v19M2 22h20M4 7h16M9 7v5h6V7M12 12v4m-5 3h10" />
      <path d="M8 3V1m8 2V1" />
    </>
  ),
  crew: (
    <>
      <path d="M4 11V8a8 8 0 0 1 16 0v3M2 11h20M8 2v5m8-5v5M6 12a6 6 0 0 0 12 0M3 22v-2a4 4 0 0 1 4-4m14 6v-2a4 4 0 0 0-4-4M8 18l4 3 4-3" />
    </>
  ),
  forklift: (
    <>
      <path d="M2 17V9h8v8m-6-8V4h6v5m0-5h4v13h8m-4 0V3m0 8h4V5h-4M2 17h12" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="13" cy="19" r="2" />
    </>
  ),
  shift: (
    <>
      <path d="M5 5a9 9 0 1 1-2 10M2 3v5h5" />
      <path d="M12 7v5l4 2M5 20l2-2" />
    </>
  ),
  workorder: (
    <>
      <path d="M8 4H5v18h14V4h-3M8 2h8v4H8Z" />
      <path d="m8 12 2 2 5-5M8 18h7" />
    </>
  ),
  logbook: (
    <>
      <path d="M6 3h14v19H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm0 0v19M10 8h6m-6 4h6m-6 4h4" />
    </>
  ),
  safety: (
    <>
      <path d="m12 2 10 19H2L12 2Z" />
      <path d="M12 9v5m0 3v.1" />
    </>
  ),
  power: (
    <>
      <path d="M12 2v10M7 5a9 9 0 1 0 10 0" />
    </>
  ),
  gear: (
    <>
      <path
        d="m9 3 1-2h4l1 2 2 1 2-.3 2 3-1 2v3l1 2-2 3-2-.3-2 1-1 3h-4l-1-3-2-1-2 .3-2-3 1-2V9L3 7l2-3 2 .3 2-1Z"
        transform="translate(0 1) scale(1 .95)"
      />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="17" rx="2" />
      <path d="M7 2v6m10-6v6M3 11h18M7 15h3m4 0h3m-10 4h3" />
    </>
  ),
  access: (
    <>
      <path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  dispatch: (
    <>
      <path d="M2 6h12v12H2ZM14 10h5l3 4v4h-8M17 10v4h5M5 6V3h6v3" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </>
  ),
  pulse: (
    <>
      <path d="M2 12h4l3-8 5 16 3-8h5M2 3h3m14 18h3" />
    </>
  ),
};
export function FactoryIcon({ name = 'plant', label, ...props }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      {...props}
    >
      {symbols[name] || symbols.plant}
    </svg>
  );
}
const icon = (name) =>
  function Symbol(props) {
    return <FactoryIcon name={name} {...props} />;
  };
export const PlantIcon = icon('plant');
export const ConveyorIcon = icon('conveyor');
export const CrewIcon = icon('crew');
export const ShiftIcon = icon('shift');
export const WorkOrderIcon = icon('workorder');
export const LogbookIcon = icon('logbook');
export const SafetyIcon = icon('safety');
export const PowerIcon = icon('power');
export const GearIcon = icon('gear');
export const AccessIcon = icon('access');
export const CalendarIcon = icon('calendar');
export const PulseIcon = icon('pulse');
