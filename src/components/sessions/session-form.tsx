"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Info,
  MapPin,
  Save,
  Tags,
  Users,
} from "lucide-react";
import type { SessionFormData } from "@/lib/sessions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Label } from "@/components/ui/field";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/feedback";
import { cn, excelMonthLabel, excelWeekNumber, parseDateInput } from "@/lib/utils";
import {
  CountMatrix,
  sumCounts,
  type Counts,
} from "@/components/sessions/count-matrix";
import { FacilitatorPicker } from "@/components/sessions/facilitator-picker";
import {
  createActivityTypeAction,
  createCommunityAction,
  createProjectAction,
  createThematicAreaAction,
  saveSessionAction,
} from "@/app/(app)/sessions/actions";
import { AddCommunityDialog } from "@/components/sessions/add-community-dialog";

export type SessionFormValues = {
  date: string;
  communityId: string | null;
  projectId: string | null;
  thematicAreaId: string | null;
  ageGroupId: string | null;
  activityTypeId: string | null;
  notes: string;
  facilitators: string[];
  counts: Counts;
};

export function SessionForm({
  data,
  initial,
  sessionId,
  canAddCommunity,
}: {
  data: SessionFormData;
  initial: SessionFormValues;
  sessionId?: string;
  canAddCommunity: boolean;
}) {
  const router = useRouter();
  const toast = useToast();

  const [values, setValues] = React.useState<SessionFormValues>(initial);
  const [communities, setCommunities] = React.useState(data.communities);
  const [projects, setProjects] = React.useState(data.projects);
  const [thematicAreas, setThematicAreas] = React.useState(data.thematicAreas);
  const [activityTypes, setActivityTypes] = React.useState(data.activityTypes);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [customProjectName, setCustomProjectName] = React.useState("");

  const projectOptions = React.useMemo(() => {
    const list = projects.map((p) => ({
      value: p.id,
      label: p.name,
    }));
    if (
      !list.some(
        (p) => p.value === "proj-other" || p.label.toLowerCase().includes("other"),
      )
    ) {
      list.push({
        value: "proj-other",
        label: "Other / Unlisted Initiative (Specify)",
      });
    }
    return list;
  }, [projects]);
  const [addCommunityQuery, setAddCommunityQuery] = React.useState<string | null>(
    null,
  );

  const set = <K extends keyof SessionFormValues>(
    key: K,
    value: SessionFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  };

  const community = communities.find((c) => c.id === values.communityId);

  // Week and month are derived, exactly as WEEKNUM() and TEXT(date,"mmm-yyyy")
  // do on the sheet — shown read-only so staff can see they match.
  const derived = React.useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) return null;
    const d = parseDateInput(values.date);
    if (Number.isNaN(d.getTime())) return null;
    return { week: excelWeekNumber(d), month: excelMonthLabel(d) };
  }, [values.date]);

  const total = sumCounts(values.counts);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!values.date) nextErrors.date = "Choose the date of the session";
    if (!values.communityId) nextErrors.communityId = "Choose the community";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast("error", "Two fields are required", "Date and community.");
      return;
    }

    setSaving(true);
    const finalNotes =
      customProjectName.trim() && values.projectId === "proj-other"
        ? values.notes
          ? `${values.notes}\n[Initiative: ${customProjectName.trim()}]`
          : `[Initiative: ${customProjectName.trim()}]`
        : values.notes;

    const result = await saveSessionAction(
      {
        date: values.date,
        communityId: values.communityId!,
        projectId: values.projectId,
        thematicAreaId: values.thematicAreaId,
        ageGroupId: values.ageGroupId,
        activityTypeId: values.activityTypeId,
        notes: finalNotes,
        facilitators: values.facilitators,
        counts: values.counts,
      },
      sessionId,
    );
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast("error", result.error);
      return;
    }

    toast(
      "success",
      sessionId ? "Session updated" : "Session logged",
      `${community?.name ?? "Session"} · ${total} participant${total === 1 ? "" : "s"}`,
    );
    router.push("/sessions");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-5 lg:space-y-6">
        {/* ---------------- When & where ---------------- */}
        <Card>
          <SectionHeader
            icon={CalendarDays}
            title="When and where"
            note="Required"
          />
          <div className="grid gap-5 px-5 pb-6 sm:grid-cols-2 sm:px-6">
            <Field
              label="Date of session"
              required
              htmlFor="date"
              error={errors.date}
            >
              <Input
                id="date"
                type="date"
                value={values.date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("date", e.target.value)}
                invalid={Boolean(errors.date)}
              />
              {derived && (
                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs text-ink-500">
                  <Badge tone="neutral">Week {derived.week}</Badge>
                  <Badge tone="neutral">{derived.month}</Badge>
                  <span className="text-ink-400">filled in automatically</span>
                </p>
              )}
            </Field>

            <Field
              label="Community"
              required
              htmlFor="community"
              error={errors.communityId}
              hint={`${communities.length} listed`}
            >
              <Combobox
                id="community"
                options={communities.map((c) => ({
                  value: c.id,
                  label: c.name,
                  meta: c.divisionSubdivision,
                  keywords: `${c.region} ${c.division} ${c.subdivision}`,
                }))}
                value={values.communityId}
                onChange={(v) => set("communityId", v)}
                placeholder="Search the community…"
                searchPlaceholder="Type a community name…"
                emptyText="No community matches that name"
                invalid={Boolean(errors.communityId)}
                onCreate={
                  canAddCommunity ? (q) => setAddCommunityQuery(q) : undefined
                }
                createLabel="Add community"
              />

              <div
                className={cn(
                  "mt-2 flex items-center gap-2 rounded-control px-3 py-2 text-[13px] transition-colors",
                  community
                    ? "bg-blue-50 text-blue-900"
                    : "bg-ink-50 text-ink-400",
                )}
              >
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {community ? (
                  <span>
                    <span className="font-medium">
                      {community.divisionSubdivision}
                    </span>
                    <span className="text-blue-700/70"> · {community.region}</span>
                  </span>
                ) : (
                  <span>Division and subdivision fill in automatically</span>
                )}
              </div>
            </Field>
          </div>
        </Card>

        {/* ---------------- Classification ---------------- */}
        <Card>
          <SectionHeader
            icon={Tags}
            title="What the session was"
            note="All optional"
          />
          <div className="grid gap-5 px-5 pb-6 sm:grid-cols-2 sm:px-6">
            <Field
              label="Project / programme"
              htmlFor="project"
              hint="Select standard or unlisted project"
            >
              <Combobox
                id="project"
                options={projectOptions}
                value={values.projectId}
                onChange={(v) => set("projectId", v)}
                placeholder="Not specified (Core VIAC)"
                searchPlaceholder="Search projects or type unlisted initiative…"
                emptyText="No match — type to add a new project"
                onCreate={async (name) => {
                  const result = await createProjectAction(name);
                  if (!result.ok) return toast("error", result.error);
                  setProjects((list) =>
                    list.some((x) => x.id === result.data.id)
                      ? list
                      : [...list, result.data],
                  );
                  set("projectId", result.data.id);
                  toast("success", `Added "${result.data.name}"`);
                }}
              />

              {values.projectId === "proj-other" && (
                <div className="mt-2.5 rounded-control bg-amber-50/70 p-3 ring-1 ring-amber-200">
                  <label className="block text-2xs font-semibold text-amber-900 uppercase">
                    Specify Initiative / Activity Title
                  </label>
                  <input
                    type="text"
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    placeholder="e.g. UNFPA Climate & SRHR Outreach, Youth Peer Club Pilot…"
                    className="mt-1 h-8 w-full rounded-control bg-white px-2.5 text-xs text-ink-900 ring-1 ring-ink-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="mt-1 text-2xs text-amber-700">
                    Saves under Unlisted / Ad-hoc initiatives and tracks your activity in project metrics.
                  </p>
                </div>
              )}
            </Field>

            <Field label="Type of activity" htmlFor="activityType">
              <Combobox
                id="activityType"
                options={activityTypes.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
                value={values.activityTypeId}
                onChange={(v) => set("activityTypeId", v)}
                placeholder="Not specified"
                searchPlaceholder="Search or type a new one…"
                onCreate={async (name) => {
                  const result = await createActivityTypeAction(name);
                  if (!result.ok) return toast("error", result.error);
                  setActivityTypes((list) =>
                    list.some((x) => x.id === result.data.id)
                      ? list
                      : [...list, result.data],
                  );
                  set("activityTypeId", result.data.id);
                  toast("success", `Added “${result.data.name}”`);
                }}
              />
            </Field>

            <Field
              label="Thematic area"
              htmlFor="thematicArea"
              hint="Free entry"
            >
              <Combobox
                id="thematicArea"
                options={thematicAreas.map((t) => ({
                  value: t.id,
                  label: t.name,
                }))}
                value={values.thematicAreaId}
                onChange={(v) => set("thematicAreaId", v)}
                placeholder="Not specified"
                searchPlaceholder="Search or type a new topic…"
                onCreate={async (name) => {
                  const result = await createThematicAreaAction(name);
                  if (!result.ok) return toast("error", result.error);
                  setThematicAreas((list) =>
                    list.some((x) => x.id === result.data.id)
                      ? list
                      : [...list, result.data],
                  );
                  set("thematicAreaId", result.data.id);
                  toast("success", `Added “${result.data.name}”`);
                }}
              />
            </Field>

            <Field label="Age group" htmlFor="ageGroup">
              <Select
                id="ageGroup"
                value={values.ageGroupId ?? ""}
                onChange={(e) => set("ageGroupId", e.target.value || null)}
              >
                <option value="">Not specified</option>
                {data.ageGroups.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Label htmlFor="facilitators">Facilitators</Label>
              <FacilitatorPicker
                id="facilitators"
                value={values.facilitators}
                onChange={(names) => set("facilitators", names)}
                suggestions={data.facilitatorNames}
              />
            </div>
          </div>
        </Card>

        {/* ---------------- Counts ---------------- */}
        <Card>
          <SectionHeader
            icon={Users}
            title="Participants"
            note="Leave a cell blank for zero"
          />
          <div className="px-5 pb-6 sm:px-6">
            <CountMatrix
              keyPopulations={data.keyPopulations}
              counts={values.counts}
              onChange={(counts) => set("counts", counts)}
            />
          </div>
        </Card>

        {/* ---------------- Notes ---------------- */}
        <Card>
          <SectionHeader icon={Info} title="Notes" note="Optional" />
          <div className="px-5 pb-6 sm:px-6">
            <Textarea
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything worth remembering about this session — venue, partners, follow-up needed…"
              rows={3}
            />
          </div>
        </Card>

        {/* ---------------- Save bar ---------------- */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-ink-100 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:rounded-card lg:border lg:border-ink-100 lg:px-6 lg:py-4 lg:shadow-card lg:backdrop-blur-none">
          <div className="flex items-center justify-between gap-4">
            <p className="hidden text-[13px] text-ink-500 sm:block">
              {total > 0 ? (
                <>
                  <span className="font-semibold text-ink-900 tabular">
                    {total}
                  </span>{" "}
                  participant{total === 1 ? "" : "s"} recorded
                </>
              ) : (
                "Only date and community are required"
              )}
            </p>
            <div className="flex flex-1 gap-2 sm:flex-none">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1 sm:flex-none"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="lg"
                loading={saving}
                className="flex-1 sm:flex-none"
              >
                {!saving &&
                  (sessionId ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  ))}
                {sessionId ? "Save changes" : "Log session"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      <AddCommunityDialog
        open={addCommunityQuery !== null}
        initialName={addCommunityQuery ?? ""}
        subdivisions={data.subdivisions}
        onCancel={() => setAddCommunityQuery(null)}
        onCreated={(created) => {
          setCommunities((list) => [
            ...list,
            {
              id: created.id,
              name: created.name,
              subdivision: created.label.split(" - ")[1] ?? "",
              division: created.label.split(" - ")[0] ?? "",
              region: "",
              divisionSubdivision: created.label,
              isCustom: true,
            },
          ]);
          set("communityId", created.id);
          setAddCommunityQuery(null);
          toast("success", `Added “${created.name}”`, created.label);
        }}
        onError={(message) => {
          toast("error", message);
          setAddCommunityQuery(null);
        }}
        createAction={createCommunityAction}
      />
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ElementType;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="size-4" aria-hidden />
        </span>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">
          {title}
        </h2>
      </div>
      {note && <span className="text-2xs text-ink-400">{note}</span>}
    </div>
  );
}
