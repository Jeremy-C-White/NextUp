import { describe, expect, it } from "vitest";
import { UserEpisode, UserShow } from "../types";
import { buildComingSchedule, describeEpisodes, premiereLabel, scheduleDayTitle, scheduleMonthTitle } from "./comingSchedule";

// Saturday, September 26 2026, 6:00 PM local time.
const NOW = new Date(2026, 8, 26, 18, 0, 0);

function show(id: string, name: string, overrides: Partial<UserShow> = {}): UserShow {
  return { id, tvmazeId: 1, name, imageUrl: "", status: "Running", provider: "", addedAt: 0, summary: "", runtime: 45, ...overrides };
}

function episode(season: number, number: number, when: Date | string, watched = false, withTime = true): UserEpisode {
  const date = typeof when === "string" ? new Date(`${when}T00:00:00`) : when;
  const airdate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return {
    id: `${season}-${number}-${date.getTime()}`, showId: 1, season, number, name: `Episode ${number}`,
    airdate, airstamp: withTime ? date.toISOString() : "", imageUrl: "", summary: "", watched
  };
}

const at = (dayOffset: number, hour: number, minute = 0) => new Date(2026, 8, 26 + dayOffset, hour, minute);

describe("buildComingSchedule", () => {
  it("groups the next seven days by day, with every episode on that day", () => {
    const lastOfUs = show("a", "The Last of Us");
    const slow = show("b", "Slow Horses");
    const drop = show("c", "Binge Show");
    const schedule = buildComingSchedule([lastOfUs, slow, drop], {
      a: [episode(1, 9, at(-20, 21), true), episode(2, 1, at(0, 21))],
      b: [episode(4, 3, at(1, 3)), episode(4, 4, at(8, 3))],
      c: [episode(1, 1, at(3, 3)), episode(1, 2, at(3, 3)), episode(1, 3, at(3, 3))]
    }, NOW);

    expect(schedule.week.map(group => group.title)).toEqual(["Today", "Tomorrow", "Tuesday, Sep 29"]);
    expect(schedule.week[0].cards[0]).toMatchObject({ premiere: "Season 2 premiere", hasTime: true });
    expect(describeEpisodes(drop, schedule.week[2].cards[0].episodes)).toBe("3 new episodes · S1 E1-E3");
    expect(schedule.week[2].cards[0].premiere).toBe("Series premiere");
    // Slow Horses airs this week, so it is not repeated under Later.
    expect(schedule.later).toEqual([]);
    expect(schedule.episodesThisWeek).toBe(5);
    expect(schedule.summary).toBe("5 episodes this week · next: The Last of Us, today 9:00 PM");
    // The week guide always has 7 columns, empty days included.
    expect(schedule.weekDays.map(day => [day.title, day.subtitle, day.cards.length])).toEqual([
      ["Today", "Sep 26", 1], ["Tomorrow", "Sep 27", 1], ["Monday", "Sep 28", 0], ["Tuesday", "Sep 29", 1],
      ["Wednesday", "Sep 30", 0], ["Thursday", "Oct 1", 0], ["Friday", "Oct 2", 0]
    ]);
    expect(schedule.weekDays[0].isToday).toBe(true);
  });

  it("puts shows that are not on this week's schedule under the month of their next episode", () => {
    const schedule = buildComingSchedule([
      show("a", "Andor"), show("b", "Severance"), show("c", "Shogun")
    ], {
      a: [episode(3, 1, at(10, 21))],
      b: [episode(3, 1, at(40, 21)), episode(3, 2, at(47, 21))],
      c: [episode(2, 1, "2027-02-10")]
    }, NOW);
    expect(schedule.week).toEqual([]);
    expect(schedule.later.map(group => [group.title, group.cards.map(card => card.show.name)])).toEqual([
      ["October", ["Andor"]],
      ["November", ["Severance"]],
      ["February 2027", ["Shogun"]]
    ]);
    expect(schedule.later[1].cards[0].episodes).toHaveLength(1);
    expect(schedule.laterCards.map(card => card.show.name)).toEqual(["Andor", "Severance", "Shogun"]);
    expect(schedule.summary).toBe("Nothing airing this week · next: Andor, Oct 6");
  });

  it("lists recently aired episodes once per show, newest first, and plays the next unwatched episode", () => {
    const behind = show("a", "Behind Show");
    const fresh = show("b", "Fresh Show");
    const schedule = buildComingSchedule([behind, fresh], {
      a: [episode(1, 1, at(-60, 21)), episode(1, 2, at(-6, 21)), episode(1, 3, at(-2, 21))],
      b: [episode(2, 1, at(-30, 21), true), episode(2, 2, at(-1, 21))]
    }, NOW);
    expect(schedule.recent.map(card => card.show.name)).toEqual(["Fresh Show", "Behind Show"]);
    expect(schedule.recent[1].episodes.map(e => e.number)).toEqual([2, 3]);
    // Play starts at the first unwatched episode (E1), even though it is older.
    expect(schedule.recent[1].playEpisode.number).toBe(1);
    expect(schedule.summary).toBe("No upcoming episodes announced for your shows yet.");
  });

  it("marks episodes with only a date and handles movies", () => {
    const movie = show("m", "Big Movie", { isMovie: true });
    const dateOnly = show("d", "Date Only");
    const schedule = buildComingSchedule([movie, dateOnly], {
      m: [{ ...episode(1, 1, at(2, 0)), id: "movie_m", name: "Movie" }],
      d: [episode(1, 5, "2026-09-30", false, false)]
    }, NOW);
    const cards = schedule.week.flatMap(group => group.cards);
    expect(cards.find(card => card.show.name === "Date Only")?.hasTime).toBe(false);
    const movieCard = cards.find(card => card.show.name === "Big Movie")!;
    expect(movieCard.premiere).toBeNull();
    expect(describeEpisodes(movie, movieCard.episodes)).toBe("Movie");
    expect(schedule.episodesThisWeek).toBe(1);
  });
});
describe("schedule labels", () => {
  it("names days and months the way people say them", () => {
    expect(scheduleDayTitle(at(0, 23), NOW)).toBe("Today");
    expect(scheduleDayTitle(at(1, 1), NOW)).toBe("Tomorrow");
    expect(scheduleDayTitle(at(5, 20), NOW)).toBe("Thursday, Oct 1");
    expect(scheduleMonthTitle(at(4, 20), NOW)).toBe("Later in September");
    expect(scheduleMonthTitle(new Date(2026, 11, 1), NOW)).toBe("December");
    expect(scheduleMonthTitle(new Date(2027, 0, 1), NOW)).toBe("January 2027");
  });

  it("labels premieres and describes episodes", () => {
    const s = show("x", "X");
    expect(premiereLabel(s, episode(1, 1, at(1, 1)))).toBe("Series premiere");
    expect(premiereLabel(s, episode(3, 1, at(1, 1)))).toBe("Season 3 premiere");
    expect(premiereLabel(s, episode(3, 2, at(1, 1)))).toBeNull();
    expect(describeEpisodes(s, [episode(2, 4, at(1, 1))])).toBe("S2 E4 · Episode 4");
    expect(describeEpisodes(s, [episode(2, 4, at(1, 1)), episode(2, 7, at(1, 1))])).toBe("2 new episodes");
  });
});
