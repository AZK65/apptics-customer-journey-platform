import {
  Sparkles,
  CalendarCheck,
  MessageCircle,
  Video,
  CircleSlash,
  FileCheck2,
  Bot,
  User,
  Trophy,
} from "lucide-react";
import type { TimelineEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/journey";

const KIND_STYLE: Record<
  TimelineEvent["kind"],
  { icon: React.ElementType; color: string }
> = {
  source: { icon: Sparkles, color: "var(--stage-source)" },
  booking: { icon: CalendarCheck, color: "var(--stage-booked)" },
  groupchat: { icon: MessageCircle, color: "var(--stage-groupchat)" },
  meeting: { icon: Video, color: "var(--stage-meeting)" },
  noshow: { icon: CircleSlash, color: "var(--stage-lost)" },
  onboarding: { icon: FileCheck2, color: "var(--stage-onboarding)" },
  followup_bot: { icon: Bot, color: "var(--muted-foreground)" },
  followup_human: { icon: User, color: "var(--muted-foreground)" },
  won: { icon: Trophy, color: "var(--stage-won)" },
};

export function JourneyTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-5">
      {events.map((e, i) => {
        const style = KIND_STYLE[e.kind];
        const Icon = style.icon;
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-4 pl-1">
            {!last && (
              <span
                className="absolute left-[18px] top-9 h-[calc(100%+4px)] w-px bg-border"
                aria-hidden
              />
            )}
            <div
              className="z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background"
              style={{ color: style.color, borderColor: `color-mix(in oklch, ${style.color} 35%, var(--border))` }}
            >
              <Icon className="size-4" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-sm font-medium">{e.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(e.at)}
                </span>
              </div>
              {e.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {e.description}
                </p>
              )}
              {e.actor && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  {e.actor}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
