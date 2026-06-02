import assert from "node:assert/strict";
import test from "node:test";
import { groupMatchesByLocalDate } from "@/lib/dashboard-match-groups";

test("groups matches by the viewer's local date boundary", () => {
  const groups = groupMatchesByLocalDate(
    [
      { id: "late", kickoff: "2026-06-11T23:30:00Z" },
      { id: "night", kickoff: "2026-06-12T01:00:00Z" },
      { id: "next-day", kickoff: "2026-06-12T16:00:00Z" },
    ],
    {
      timeZone: "America/New_York",
      now: "2026-06-10T00:00:00Z",
    }
  );

  assert.deepEqual(
    groups.map((group) => ({
      dateKey: group.dateKey,
      ids: group.matches.map((match) => match.id),
    })),
    [
      { dateKey: "2026-06-11", ids: ["late", "night"] },
      { dateKey: "2026-06-12", ids: ["next-day"] },
    ]
  );
});

test("sorts matches within each date group by kickoff ascending", () => {
  const groups = groupMatchesByLocalDate(
    [
      { id: "third", kickoff: "2026-06-11T21:00:00Z" },
      { id: "first", kickoff: "2026-06-11T18:00:00Z" },
      { id: "second", kickoff: "2026-06-11T19:30:00Z" },
    ],
    {
      timeZone: "UTC",
      now: "2026-06-10T00:00:00Z",
    }
  );

  assert.deepEqual(groups[0]?.matches.map((match) => match.id), [
    "first",
    "second",
    "third",
  ]);
});

test("marks only future groups within 24 hours for the deadline badge", () => {
  const groups = groupMatchesByLocalDate(
    [
      { id: "past", kickoff: "2026-06-10T18:00:00Z" },
      { id: "soon", kickoff: "2026-06-11T18:00:00Z" },
      { id: "later", kickoff: "2026-06-12T20:00:00Z" },
    ],
    {
      timeZone: "UTC",
      now: "2026-06-10T20:00:00Z",
    }
  );

  assert.deepEqual(
    groups.map((group) => ({
      dateKey: group.dateKey,
      showDeadline: group.showDeadline,
    })),
    [
      { dateKey: "2026-06-10", showDeadline: false },
      { dateKey: "2026-06-11", showDeadline: true },
      { dateKey: "2026-06-12", showDeadline: false },
    ]
  );
});
