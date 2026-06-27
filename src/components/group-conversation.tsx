import { MessageSquare } from "lucide-react";
import type { GroupMessage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/journey";
import { cn } from "@/lib/utils";

/** The actual conversation read from a sales-bot group (WhatsApp/Telegram). */
export function GroupConversation({
  messages,
  platformLabel,
}: {
  messages: GroupMessage[];
  platformLabel: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="size-4 text-[var(--stage-groupchat)]" />
          Group Conversation
          <span className="text-xs font-normal text-muted-foreground">
            {platformLabel} · {messages.length} messages
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[28rem] space-y-2.5 overflow-y-auto pt-0">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col", m.fromMe ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                m.fromMe
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted text-foreground",
              )}
            >
              {m.body}
            </div>
            <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">
              {m.fromMe ? "Apptics" : "Customer"} · {formatDateTime(m.at)}
            </span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No messages in this group yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
