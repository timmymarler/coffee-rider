export function getOpeningStatus(openingHours) {
  if (!openingHours || !openingHours.periods) {
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
      color: "#c0392b",
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
        color: closingSoon ? "#f39c12" : "#27ae60",
        isOpen: true,
        closingSoon,
        todayText: null,
      };
    }
  }

  return {
    label: "Closed",
    color: "#c0392b",
    isOpen: false,
    closingSoon: false,
    todayText: null,
  };
}

export function formatWeekdayText(openingHours) {
  if (!openingHours?.weekday_text) return [];
  return openingHours.weekday_text;
}
