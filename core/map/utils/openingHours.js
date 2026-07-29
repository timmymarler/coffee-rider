function getWeekdayText(openingHours) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours.weekday_text)) return openingHours.weekday_text;
  if (Array.isArray(openingHours.weekdayDescriptions)) return openingHours.weekdayDescriptions;
  return [];
}

function parseTimeToMinutes(hhmm) {
  const raw = String(hhmm || "").trim();
  if (!raw) return null;

  let hours;
  let mins;

  if (/^\d{4}$/.test(raw)) {
    hours = Number.parseInt(raw.slice(0, 2), 10);
    mins = Number.parseInt(raw.slice(2), 10);
  } else if (/^\d{3}$/.test(raw)) {
    hours = Number.parseInt(raw.slice(0, 1), 10);
    mins = Number.parseInt(raw.slice(1), 10);
  } else {
    const clockMatch = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!clockMatch) return null;
    hours = Number.parseInt(clockMatch[1], 10);
    mins = Number.parseInt(clockMatch[2], 10);
  }

  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  return hours * 60 + mins;
}

function parseClockTimeToMinutes(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
  if (!match) return null;

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2] || "0", 10);
  const meridiem = (match[3] || "").toLowerCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = hours % 12;
    if (meridiem === "pm") hours += 12;
  } else if (hours > 23) {
    return null;
  }

  return hours * 60 + minutes;
}

function isOpenFromTodayText(todayText, now) {
  const line = String(todayText || "").trim();
  if (!line) return null;

  const lower = line.toLowerCase();
  if (lower.includes("open 24 hours")) {
    return true;
  }
  if (lower.includes("closed")) {
    return false;
  }

  const timeRanges = line.match(/(\d{1,2}(?::\d{2})?\s*[ap]m?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*[ap]m?)/gi);
  if (!timeRanges || timeRanges.length === 0) {
    return null;
  }

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const range of timeRanges) {
    const parts = range.split(/\s*[-–]\s*/);
    if (parts.length !== 2) continue;

    const openMinutes = parseClockTimeToMinutes(parts[0]);
    const closeMinutes = parseClockTimeToMinutes(parts[1]);
    if (openMinutes === null || closeMinutes === null) continue;

    if (openMinutes === closeMinutes) {
      return true;
    }

    if (closeMinutes > openMinutes) {
      if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
        return true;
      }
    } else {
      // Overnight window (e.g., 8:00 PM - 2:00 AM)
      if (nowMinutes >= openMinutes || nowMinutes < closeMinutes) {
        return true;
      }
    }
  }

  return false;
}

function parseDayValue(dayValue) {
  if (Number.isInteger(dayValue)) {
    if (dayValue >= 0 && dayValue <= 6) return dayValue;
    // Some providers encode weekday as ISO (Mon=1 ... Sun=7)
    if (dayValue >= 1 && dayValue <= 7) return dayValue % 7;
    return null;
  }

  const raw = String(dayValue ?? "").trim().toLowerCase();
  if (!raw) return null;

  const namedDayMap = {
    sun: 0,
    sunday: 0,
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
  };
  if (Object.prototype.hasOwnProperty.call(namedDayMap, raw)) {
    return namedDayMap[raw];
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed >= 0 && parsed <= 6) return parsed;
  if (parsed >= 1 && parsed <= 7) return parsed % 7;
  return null;
}

function formatMinutesAsTime(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function resolveOpeningHoursNow(openingHours, now) {
  const rawOffset =
    openingHours?.utc_offset_minutes ??
    openingHours?.utcOffsetMinutes ??
    openingHours?.utc_offset ??
    openingHours?.utcOffset ??
    null;
  const numericOffset = Number(rawOffset);

  const offsetMinutes = Number.isFinite(numericOffset)
    ? numericOffset
    : -now.getTimezoneOffset();

  return new Date(now.getTime() + offsetMinutes * 60000);
}

function getTodayWeekdayLine(weekdayText, jsDay) {
  if (!Array.isArray(weekdayText) || weekdayText.length === 0) return null;
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const name = names[jsDay];
  const shortName = short[jsDay];
  if (!name) return null;

  const normalized = weekdayText.map((line) => String(line || "").trim());
  const fullPrefix = `${name.toLowerCase()}:`;
  const fullNoColon = `${name.toLowerCase()} `;
  const shortPrefix = shortName ? `${shortName.toLowerCase()}:` : null;
  const shortNoColon = shortName ? `${shortName.toLowerCase()} ` : null;

  const matched = normalized.find((line) => {
    const lower = line.toLowerCase();
    return (
      lower.startsWith(fullPrefix) ||
      lower === name.toLowerCase() ||
      lower.startsWith(fullNoColon) ||
      (shortPrefix && lower.startsWith(shortPrefix)) ||
      (shortNoColon && lower.startsWith(shortNoColon)) ||
      (shortName && lower === shortName.toLowerCase())
    );
  });

  if (matched) return matched;

  // Fallback for providers that return Monday-first arrays without day labels.
  if (normalized.length === 7 && normalized.every((line) => line.length > 0)) {
    const mondayFirstIndex = (jsDay + 6) % 7;
    return normalized[mondayFirstIndex] || null;
  }

  return null;
}

function getActivePeriod(openingHours, now) {
  if (!Array.isArray(openingHours?.periods) || openingHours.periods.length === 0) {
    return null;
  }

  const nowWeekMinutes = now.getUTCDay() * 1440 + (now.getUTCHours() * 60 + now.getUTCMinutes());
  const weekMinutes = 7 * 1440;

  for (const p of openingHours.periods) {
    const openDay = parseDayValue(p?.open?.day);
    const openTime = parseTimeToMinutes(p?.open?.time);

    if (openDay === null || openTime === null) {
      continue;
    }

    const openWeekMinutes = openDay * 1440 + openTime;

    const closeDay = parseDayValue(p?.close?.day) ?? openDay;
    const parsedCloseTime = parseTimeToMinutes(p?.close?.time);

    // If close is present but malformed, skip this period instead of assuming open.
    if (p?.close && parsedCloseTime === null) {
      continue;
    }

    // Missing close block usually means 24h window from open time.
    const closeTime = parsedCloseTime === null ? openTime : parsedCloseTime;

    let closeWeekMinutes = closeDay * 1440 + closeTime;
    if (!p?.close) {
      closeWeekMinutes = openWeekMinutes + 1440;
    } else if (closeWeekMinutes <= openWeekMinutes) {
      // Same-day close <= open means overnight rollover into next day.
      // Different-day close <= open implies week boundary wrap.
      closeWeekMinutes += closeDay === openDay ? 1440 : weekMinutes;
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
  const localNow = resolveOpeningHoursNow(openingHours, now);
  const todayText = getTodayWeekdayLine(weekdayText, localNow.getUTCDay());

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
      const inferredOpen = isOpenFromTodayText(todayText, localNow);
      if (inferredOpen !== null) {
        return {
          label: inferredOpen ? "Open now" : "Closed",
          color: inferredOpen ? "#22c55e" : "#DC2626",
          isOpen: inferredOpen,
          closingSoon: false,
          todayText,
        };
      }

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

  const hasUsablePeriods = openingHours.periods.some((p) => {
    const openDay = parseDayValue(p?.open?.day);
    const openTime = parseTimeToMinutes(p?.open?.time);
    return openDay !== null && openTime !== null;
  });

  const activePeriod = getActivePeriod(openingHours, localNow);
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

  // If we have valid schedule periods and none is active, trust the schedule over open_now.
  if (hasUsablePeriods) {
    return {
      label: "Closed",
      color: "#DC2626",
      isOpen: false,
      closingSoon: false,
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
