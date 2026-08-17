import { cn } from "@/lib/utils";

interface YahLogoProps {
  className?: string;
  height?: number;
}

/**
 * yah.homes horizontal logo as inline SVG（yah マーク＋homes ワード）.
 * Uses currentColor so the parent's text color controls the fill.
 * Usage:
 *   <YahLogo className="text-white h-8" />   → white logo
 *   <YahLogo className="text-black h-8" />   → black logo
 */
export function YahLogo({ className, height = 32 }: YahLogoProps) {
  const width = Math.round((258 / 90) * height);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 258 90"
      width={width}
      height={height}
      className={cn("inline-block", className)}
      aria-label="yah.homes"
    >
      <style>{`.yl{fill:currentColor}`}</style>
      <g>
        <path className="yl" d="M132.45,66.4c-.75,2.76-3.39,4.26-6.1,3.51-2.76-.75-4.26-3.34-3.51-6.04.75-2.76,3.34-4.31,6.04-3.57,2.76.75,4.31,3.39,3.57,6.1Z"/>
        <path className="yl" d="M105.16,34.53c-3.77-.9-7.2-.08-10.14,2.85l3.58-15.43-4.33-1-1.77-.4-8.99,39.24,6.04,1.39,3.03-13.24c1.49-6.44,4.67-9.21,9.49-8.12,3.72.84,5.26,3.78,4.27,8.19l-3.73,16.14,6.21,1.39,3.87-16.89c1.74-7.55-.98-12.63-7.54-14.12Z"/>
        <path className="yl" d="M64.91,38.28c7.98.97,11.48,5.18,10.55,12.64l-2.22,18.09-6.15-.76.43-3.95c-2.29,2.7-5.65,3.99-9.62,3.5-5.79-.7-9.22-4.86-8.57-10.12.65-4.91,4.53-7.9,10.24-7.71l8.04.15c1.23.06,1.7-.3,1.82-1.13l.09-.59c.24-2.42-1.62-4.07-5.23-4.55-3.9-.44-6.73.89-7.8,3.59l-4.54-3.78c2.02-4.23,6.51-6.14,12.96-5.36ZM60.35,55.07c-2.68-.03-4.32,1.13-4.6,3.2-.26,2.3,1.31,3.94,4.26,4.28,4.32.55,8.02-2.06,8.47-5.84l.17-1.65h-8.31Z"/>
        <path className="yl" d="M4.79,41.58l-4.79-3.64C10.18,24.56,26.04,13.47,44.66,6.69,63.28-.09,82.57-1.78,98.96,1.91l-1.32,5.87c-15.28-3.45-33.36-1.83-50.91,4.56C29.17,18.73,14.28,29.11,4.79,41.58Z"/>
        <polygon className="yl" points="33.96 47.49 30.72 66.57 18.22 51.82 12.94 55.75 29.47 74.4 26.83 90 32.9 90 40.07 47.49 33.96 47.49"/>
      </g>
      <text
        x="140"
        y="69"
        fontSize="34"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="600"
        fill="currentColor"
      >
        homes
      </text>
    </svg>
  );
}
