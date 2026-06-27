"use client";

import {
  Briefcase,
  Mail,
  Users,
  Globe,
  Megaphone,
  AtSign,
  MonitorPlay,
  PhoneCall,
  MessageCircle,
  Send,
  Hash,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

// Curated icon registry so `SOURCE_META`/`PLATFORM_META` icon strings resolve
// to real components without pulling the whole lucide bundle dynamically.
// (lucide-react v1 dropped brand logos, so we map those to neutral icons.)
export const ICONS: Record<string, LucideIcon> = {
  Linkedin: Briefcase,
  Mail,
  Users,
  Globe,
  Megaphone,
  Twitter: AtSign,
  Youtube: MonitorPlay,
  PhoneCall,
  MessageCircle,
  Send,
  Slack: Hash,
  MessageSquare,
};

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Globe;
  return <Icon className={className} />;
}
