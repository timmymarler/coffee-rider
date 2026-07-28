function getWeekdayText(openingHours) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours.weekday_text)) return openingHours.weekday_text;
  if (Array.isArray(openingHours.weekdayDescriptions)) return openingHours.weekdayDescriptions;
  return [];
}

function parseTimeToMinutes(hhmm) {
  const raw = String(hhmm || "").trim();
  if (!/^\d{4}$/.test(raw)) return null;
  const hours = Number.parseInt(raw.slice(0, 2), 10);
  const mins = Number.parseInt(raw.slice(2), 10);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

function parseDayValue(dayValue) {
  if (Number.isInteger(dayValue)) return dayValue;
  const parsed = Number.parseInt(String(dayValue ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 6) return null;
  return parsed;
}

function formatMinutesAsTime(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getTodayWeekdayLine(weekdayText, jsDay) {
  if (!Array.isArray(weekdayText) || weekdayText.length === 0) return null;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const name = names[jsDay];
  if (!name) return null;
  const lowerPrefix = `${name.toLowerCase()}:`;
  return weekdayText.find((line) => String(line || "").toLowerCase().startsWith(lowerPrefix)) || null;
}

function getActivePeriod(openingHours, now) {
  if (!Array.isArray(openingHours?.periods) || openingHours.periods.length === 0) {
    return null;
  }

  const nowWeekMinutes = now.getDay() * 1440 + (now.getHours() * 60 + now.getMinutes());
  const weekMinutes = 7 * 1440;

  for (const p of openingHours.periods) {
    const openDay = parseDayValue(p?.open?.day);
    const openTime = parseTimeToMinutes(p?.open?.time);

    if (openDay === null || openTime === null) {
      continue;
    }

    const openWeekMinutes = openDay * 1440 + openTime;

    // Missing close block in Google periods commonly means 24-hour opening from open time.
    const closeDay = parseDayValue(p?.close?.day) ?? openDay;
    const parsedCloseTime = parseTimeToMinutes(p?.close?.time);
    const closeTime = parsedCloseTime === null ? openTime : parsedCloseTime;

    let closeWeekMinutes = closeDay * 1440 + closeTime;
    if (!p?.close) {
      closeWeekMinutes = openWeekMinutes + 1440;
    } else if (closeWeekMinutes <= openWeekMinutes) {
      closeWeekMinutes += weekMinutes;
    }

    const nowCandidates = [nowWeekMinutes, nowWeekMinutes + weekMinutes];
    for (const nowCandidate of nowCandidates) {
      if (nowCandidate >= openWeekMinutes && nowCandidate < closeWeekMinutes) {
        return { period: p, closeAtWeekMinutes: closeWeekMinutes, nowWeekMinutes: nowCandidate };
      }
    }
  }

  return null;
}

export function getOpeningStatus(openingHours) {
  if (!openingHours) {
    return {
      label: "Opening hours not available",
      color: "#999",
      isOpen: false,
      closingSoon: false,
      todayText: null,
    };
  }

  const openNow = openingHours.open_now ?? openingHours.openNow ?? null;
  const weekdayText = getWeekdayText(openingHours);
  const now = new Date();
  const todayText = getTodayWeekdayLine(weekdayText, now.getDay());

  if (!openingHours.periods || !Array.isArray(openingHours.periods)) {
    const has24hToday = String(todayText || "").toLowerCase().includes("open 24 hours");
    if (has24hToday) {
      return {
        label: "Open now · 24 hours",
        color: "#22c55e",
        isOpen: true,
        closingSoon: false,
        todayText,
      };
    }

    if (weekdayText.length > 0) {
      const label = openNow === true
        ? "Open now"
        : (openNow === false ? "Closed" : "Opening hours available");
      return {
        label,
        color: openNow === true ? "#22c55e" : "#999",
        isOpen: openNow === true,
        closingSoon: false,
        todayText,
      };
    }

    return {
      label: "Opening hours not available",
      color: "#999",
      isOpen: false,
      closingSoon: false,
      todayText,
    };
  }

  const activePeriod = getActivePeriod(openingHours, now);
  if (activePeriod) {
    const minsLeft = activePeriod.closeAtWeekMinutes - activePeriod.nowWeekMinutes;
    const closingSoon = minsLeft <= 30;
    const closeLabel = formatMinutesAsTime(activePeriod.closeAtWeekMinutes);

    // Google uses open/close same clock time across days to represent all-day schedules.
    const openTime = parseTimeToMinutes(activePeriod.period?.open?.time);
    const closeTime = parseTimeToMinutes(activePeriod.period?.close?.time);
    const isAllDay =
      (!activePeriod.period?.close && minsLeft >= 23 * 60) ||
      (openTime !== null && closeTime !== null && openTime === closeTime);

    return {
      label: isAllDay ? "Open now · 24 hours" : `Open now · Closes ${closeLabel}`,
      color: closingSoon && !isAllDay ? "#FACC15" : "#22c55e",
      isOpen: true,
      closingSoon: closingSoon && !isAllDay,
      todayText,
    };
  }

  return {
    label: openNow === true ? "Open now" : "Closed",
    color: openNow === true ? "#22c55e" : "#DC2626",
    isOpen: openNow === true,
    closingSoon: false,
    todayText,
  };
}

export function formatWeekdayText(openingHours) {
  return getWeekdayText(openingHours);
}
