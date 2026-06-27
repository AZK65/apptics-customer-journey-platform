import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  MessageCircle,
  Video,
  FileCheck2,
  Bot,
  User,
  Mail,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { getCustomer } from "@/lib/data";
import {
  buildTimeline,
  effectiveStage,
  SERVICE_META,
  SOURCE_META,
  PLATFORM_META,
  formatCurrency,
  formatDateTime,
} from "@/lib/journey";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerAvatar } from "@/components/customer-avatar";
import { StageBadge } from "@/components/stage-badge";
import { JourneyStepper } from "@/components/journey-stepper";
import { JourneyTimeline } from "@/components/journey-timeline";
import { GroupConversation } from "@/components/group-conversation";
import { DynamicIcon } from "@/components/lucide";

// Render per-request so live CRM data is always fresh (and any lead id resolves).
export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  color,
  status,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  status?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-md"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
                color,
              }}
            >
              <Icon className="size-4" />
            </span>
            {title}
          </span>
          {status && (
            <span className="text-xs font-normal text-muted-foreground">
              {status}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) notFound();

  const events = buildTimeline(c);
  const stage = effectiveStage(c);
  const src = SOURCE_META[c.attribution.source];

  return (
    <div>
      <PageHeader title="Customer Journey" subtitle={c.company}>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </PageHeader>

      <div className="space-y-6 p-6">
        {/* Identity + stepper */}
        <Card>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CustomerAvatar
                  name={c.name}
                  color={c.avatarColor}
                  className="size-12 text-base"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{c.name}</h2>
                    <StageBadge stage={stage} />
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{c.company}</span>
                    <span className="flex items-center gap-1">
                      <Mail className="size-3.5" />
                      {c.email}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Deal value</div>
                <div className="text-xl font-semibold">
                  {c.dealValue > 0 ? formatCurrency(c.dealValue) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Owner · {c.owner}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {c.services.map((s) => (
                <span
                  key={s}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {SERVICE_META[s]}
                </span>
              ))}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <JourneyStepper c={c} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Timeline + group conversation */}
          <div className="space-y-6 lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Journey Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <JourneyTimeline events={events} />
              </CardContent>
            </Card>

            {c.groupChat?.messages && c.groupChat.messages.length > 0 && (
              <GroupConversation
                messages={c.groupChat.messages}
                platformLabel={PLATFORM_META[c.groupChat.platform].label}
              />
            )}
          </div>

          {/* Integration panels */}
          <div className="space-y-4 lg:col-span-2">
            {/* Attribution */}
            <IntegrationCard
              icon={Sparkles}
              title="Attribution"
              color="var(--stage-source)"
              status={src.label}
            >
              <div className="divide-y">
                <Row
                  label="Source"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <DynamicIcon name={src.icon} className="size-3.5" />
                      {src.label}
                    </span>
                  }
                />
                {c.attribution.campaign && (
                  <Row label="Campaign" value={c.attribution.campaign} />
                )}
                {c.attribution.ad?.adName && (
                  <Row
                    label="Facebook ad"
                    value={
                      <span className="inline-flex flex-col items-end">
                        <span>{c.attribution.ad.adName}</span>
                        {c.attribution.ad.campaignName && (
                          <span className="text-xs text-muted-foreground">
                            {c.attribution.ad.campaignName}
                          </span>
                        )}
                      </span>
                    }
                  />
                )}
                {c.attribution.detail && (
                  <Row label="Detail" value={c.attribution.detail} />
                )}
                {c.attribution.capturedBy && (
                  <Row label="Captured by" value={c.attribution.capturedBy} />
                )}
                <Row
                  label="First touch"
                  value={formatDateTime(c.attribution.capturedAt)}
                />
              </div>
            </IntegrationCard>

            {/* Cal.com booking */}
            {c.booking ? (
              <IntegrationCard
                icon={CalendarCheck}
                title="Cal.com Booking"
                color="var(--stage-booked)"
                status={c.booking.status}
              >
                <div className="divide-y">
                  <Row label="Event" value={c.booking.eventType} />
                  <Row
                    label="Scheduled for"
                    value={formatDateTime(c.booking.scheduledFor)}
                  />
                  <Row
                    label="Booked on"
                    value={formatDateTime(c.booking.bookedAt)}
                  />
                  {c.booking.ref && (
                    <Row
                      label="Ref"
                      value={
                        <span className="inline-flex items-center gap-1 font-mono text-xs">
                          {c.booking.ref}
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </span>
                      }
                    />
                  )}
                </div>
              </IntegrationCard>
            ) : (
              <IntegrationCard
                icon={CalendarCheck}
                title="Cal.com Booking"
                color="var(--muted-foreground)"
                status="Not booked"
              >
                <p className="text-sm text-muted-foreground">
                  No call booked yet.
                </p>
              </IntegrationCard>
            )}

            {/* Group chat */}
            {c.groupChat && (
              <IntegrationCard
                icon={MessageCircle}
                title="Group Chat"
                color="var(--stage-groupchat)"
                status={PLATFORM_META[c.groupChat.platform].label}
              >
                <div className="divide-y">
                  <Row
                    label="Created by"
                    value={
                      c.groupChat.createdByBot ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Bot className="size-3.5" />
                          {c.groupChat.botName}
                        </span>
                      ) : (
                        "Sales rep"
                      )
                    }
                  />
                  <Row label="Members" value={c.groupChat.memberCount} />
                  <Row
                    label="Created"
                    value={formatDateTime(c.groupChat.createdAt)}
                  />
                  {c.groupChat.lastActivityAt && (
                    <Row
                      label="Last activity"
                      value={formatDateTime(c.groupChat.lastActivityAt)}
                    />
                  )}
                </div>
              </IntegrationCard>
            )}

            {/* Meeting */}
            {c.meeting && (
              <IntegrationCard
                icon={Video}
                title="Meeting"
                color="var(--stage-meeting)"
                status={
                  c.meeting.attended === true
                    ? "Attended"
                    : c.meeting.attended === false
                      ? "No-show"
                      : "Upcoming"
                }
              >
                <div className="divide-y">
                  <Row
                    label="Scheduled"
                    value={formatDateTime(c.meeting.scheduledFor)}
                  />
                  {c.meeting.durationMin && (
                    <Row label="Duration" value={`${c.meeting.durationMin} min`} />
                  )}
                  {c.meeting.notes && (
                    <Row label="Notes" value={c.meeting.notes} />
                  )}
                </div>
              </IntegrationCard>
            )}

            {/* Onboarding */}
            <IntegrationCard
              icon={FileCheck2}
              title="Onboarding Form"
              color="var(--stage-onboarding)"
              status={
                c.onboarding?.completedAt
                  ? c.onboarding.form === "crm"
                    ? "CRM ✓"
                    : "Payment ✓"
                  : "Pending"
              }
            >
              {c.onboarding?.completedAt ? (
                <div className="divide-y">
                  <Row
                    label="Form"
                    value={
                      c.onboarding.form === "crm"
                        ? "CRM onboarding"
                        : "Payment processor"
                    }
                  />
                  <Row
                    label="Completed"
                    value={formatDateTime(c.onboarding.completedAt)}
                  />
                  {c.onboarding.crmRecordId && (
                    <Row
                      label="CRM record"
                      value={
                        <span className="font-mono text-xs">
                          {c.onboarding.crmRecordId}
                        </span>
                      }
                    />
                  )}
                  {c.onboarding.paymentCustomerId && (
                    <Row
                      label="Payment customer"
                      value={
                        <span className="font-mono text-xs">
                          {c.onboarding.paymentCustomerId}
                        </span>
                      }
                    />
                  )}
                  {c.onboarding.fields &&
                    Object.entries(c.onboarding.fields).map(([k, v]) => (
                      <Row key={k} label={k} value={v} />
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No onboarding form completed yet.
                </p>
              )}
            </IntegrationCard>

            {/* Follow-ups */}
            {c.followUps.length > 0 && (
              <IntegrationCard
                icon={MessageCircle}
                title="Follow-ups"
                color="var(--muted-foreground)"
                status={`${c.followUps.length} total`}
              >
                <div className="space-y-3">
                  {c.followUps.map((f, i) => (
                    <div key={i} className="flex gap-2.5 text-sm">
                      <span className="mt-0.5 shrink-0 text-muted-foreground">
                        {f.by === "bot" ? (
                          <Bot className="size-4" />
                        ) : (
                          <User className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p>{f.message}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {f.actorName} · {f.channel} ·{" "}
                          {formatDateTime(f.at)} ·{" "}
                          {f.responded ? (
                            <span className="text-[var(--stage-won)]">
                              replied
                            </span>
                          ) : (
                            <span className="text-[var(--stage-lost)]">
                              no reply
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </IntegrationCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
