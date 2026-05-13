function getWeekdayText(openingHours) {
  if (!openingHours) return [];
  if (Array.isArray(openingHours.weekday_text)) return openingHours.weekday_text;
  if (Array.isArray(openingHours.weekdayDescriptions)) return openingHours.weekdayDescriptions;
  return [];
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

  if (!openingHours.periods || !Array.isArray(openingHours.periods)) {
    if (weekdayText.length > 0) {
      const label = openNow === true
        ? "Open now"
        : (openNow === false ? "Closed" : "Opening hours available");
      return {
        label,
        color: openNow === true ? "#22c55e" : "#999",
        isOpen: openNow === true,
        closingSoon: false,
        todayText: null,
      };
    }

    return {
      label: "Opening hours not available",
      color: "#999",
      isOpen: false,
      closingSoon: false,
      todayText: null,
    };
  }

  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const todayPeriods = openingHours.periods.filter(p =>
    p.open?.day === day
  );

  if (!todayPeriods.length) {
    return {
      label: "Closed today",
      color: "#DC2626",
      isOpen: false,
      closingSoon: false,
      todayText: null,
    };
  }

  for (const p of todayPeriods) {
    if (!p.open?.time || !p.close?.time) continue;
    const openMin =
      parseInt(p.open.time.slice(0, 2)) * 60 +
      parseInt(p.open.time.slice(2));

    const closeMin =
      parseInt(p.close.time.slice(0, 2)) * 60 +
      parseInt(p.close.time.slice(2));

    if (minutesNow >= openMin && minutesNow < closeMin) {
      const minsLeft = closeMin - minutesNow;

      const closingSoon = minsLeft <= 30;

      const closeLabel = `${p.close.time.slice(0,2)}:${p.close.time.slice(2)}`;

      return {
        label: `Open now · Closes ${closeLabel}`,
        color: closingSoon ? "#FACC15" : "#22c55e",
        isOpen: true,
        closingSoon,
        todayText: null,
      };
    }
  }

  return {
    label: "Closed",
    color: "#DC2626",
    isOpen: false,
    closingSoon: false,
    todayText: null,
  };
}

export function formatWeekdayText(openingHours) {
  return getWeekdayText(openingHours);
}
