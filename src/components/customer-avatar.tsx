import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/journey";
import { cn } from "@/lib/utils";

export function CustomerAvatar({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-9", className)}>
      <AvatarFallback
        className="text-xs font-semibold text-white"
        style={{ backgroundColor: color }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
