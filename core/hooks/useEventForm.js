// core/hooks/useEventForm.js
import { EVENT_VISIBILITY } from "@core/map/events/sharedEvents";
import { getCapabilities } from "@core/roles/capabilities";
import { useState } from "react";
import { useEvents } from "./useEvents";

export function useEventForm(initialDate = null, userRole = null) {
  const { createEvent } = useEvents();
  
  // Initialize with passed date or current date/time
  const getInitialDateTime = () => {
    if (initialDate && initialDate instanceof Date) {
      return initialDate;
    }
    return new Date();
  };
  
  // Place owners have public events by default, others are private
  const getDefaultVisibility = () => {
    const caps = getCapabilities(userRole);
    // Place owners with canShareEvents capability default to public
    return userRole === "place-owner" && caps?.canShareEvents ? EVENT_VISIBILITY.PUBLIC : EVENT_VISIBILITY.PRIVATE;
  };
  
  const startDate = getInitialDateTime();
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1); // Default 1 hour duration
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    placeId: "",
    placeName: "",
    startDateTime: startDate,
    endDateTime: endDate,
    maxAttendees: null,
    suitability: [], // [Bikes, Scooters, Cars]
    region: "",
    recurrence: "one-off", // "one-off", "weekly", "monthly"
    recurrenceEndDate: null,
    recurrenceDayOfWeek: null, // For weekly: 0-6 (Mon-Sun)
    recurrencePattern: "date", // For monthly: "date" (15th) or "day" (1st Wednesday)
    recurrenceDateOfMonth: 1,
    recurrenceDayOfMonth: 1, // "1st", "2nd", "3rd", "4th", "last"
    recurrenceDayOfWeekMonthly: 3, // 0-6 (Mon-Sun)
    visibility: getDefaultVisibility(),
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const updateForm = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const generateRecurrenceEvents = (baseEvent) => {
    const events = [baseEvent];

    if (formData.recurrence === "one-off") {
      return events;
    }

    const endDate = formData.recurrenceEndDate || new Date(baseEvent.startDateTime);
    endDate.setMonth(endDate.getMonth() + 12); // Default 1 year

    let currentDate = new Date(baseEvent.startDateTime);

    if (formData.recurrence === "weekly") {
      while (currentDate <= endDate) {
        currentDate.setDate(currentDate.getDate() + 7);
        if (currentDate <= endDate) {
          const eventCopy = {
            ...baseEvent,
            startDateTime: new Date(currentDate),
            endDateTime: new Date(
              new Date(currentDate).getTime() +
                (new Date(baseEvent.endDateTime) -
                  new Date(baseEvent.startDateTime))
            ),
          };
          events.push(eventCopy);
        }
      }
    } else if (formData.recurrence === "monthly") {
      if (formData.recurrencePattern === "date") {
        while (currentDate <= endDate) {
          currentDate.setMonth(currentDate.getMonth() + 1);
          if (currentDate <= endDate) {
            const eventCopy = {
              ...baseEvent,
              startDateTime: new Date(currentDate),
              endDateTime: new Date(
                new Date(currentDate).getTime() +
                  (new Date(baseEvent.endDateTime) -
                    new Date(baseEvent.startDateTime))
              ),
            };
            events.push(eventCopy);
          }
        }
      } else if (formData.recurrencePattern === "day") {
        // E.g., "1st Wednesday" of each month
        const patterns = {
          "1st": 0,
          "2nd": 1,
          "3rd": 2,
          "4th": 3,
          last: -1,
        };

        const occurrence = patterns[formData.recurrenceDayOfMonth];
        const dayOfWeek = formData.recurrenceDayOfWeekMonthly;

        while (currentDate <= endDate) {
          const month = currentDate.getMonth();
          let date = new Date(currentDate.getFullYear(), month, 1);

          // Find the nth occurrence of the day
          let count = 0;
          let found = false;

          while (date.getMonth() === month) {
            if (date.getDay() === dayOfWeek) {
              if (
                (occurrence >= 0 && count === occurrence) ||
                (occurrence === -1 &&
                  new Date(date.getFullYear(), month + 1, 0).getDate() -
                    date.getDate() <
                    7)
              ) {
                found = true;
                break;
              }
              count++;
            }
            date.setDate(date.getDate() + 1);
          }

          if (found) {
            date.setHours(baseEvent.startDateTime.getHours());
            date.setMinutes(baseEvent.startDateTime.getMinutes());

            const eventCopy = {
              ...baseEvent,
              startDateTime: new Date(date),
              endDateTime: new Date(
                new Date(date).getTime() +
                  (new Date(baseEvent.endDateTime) -
                    new Date(baseEvent.startDateTime))
              ),
            };
            events.push(eventCopy);
          }

          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }
    }

    return events;
  };

  // Accept overrides for fields (e.g., visibility, groupIds)
  const submitForm = async (overrides = {}) => {
    try {
      setSubmitting(true);
      setError(null);

      const merged = { ...formData, ...overrides };
      if (!merged.title || !merged.placeId) {
        throw new Error("Title and place are required");
      }

      // Generate a seriesId for recurring events
      const seriesId = merged.recurrence !== "one-off" ? `series-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : null;

      const baseEvent = {
        title: merged.title,
        description: merged.description,
        placeId: merged.placeId,
        placeName: merged.placeName,
        routeId: merged.routeId || null,
        startDateTime: merged.startDateTime,
        endDateTime: merged.endDateTime,
        maxAttendees: merged.maxAttendees,
        suitability: merged.suitability,
        region: merged.region,
        recurrence: merged.recurrence,
        recurrenceType: merged.recurrence,
        visibility: merged.visibility,
        groupIds: merged.groupIds || [],
        ...(seriesId && { seriesId }),
      };

      // If recurrent, generate all instances
      if (formData.recurrence !== "one-off") {
        const events = generateRecurrenceEvents(baseEvent);
        for (const event of events) {
          await createEvent(event);
        }
      } else {
        await createEvent(baseEvent);
      }

      // Reset form
      setFormData({
        title: "",
        description: "",
        placeId: "",
        placeName: "",
        startDateTime: new Date(),
        endDateTime: new Date(),
        maxAttendees: null,
        suitability: [],
        region: "",
        recurrence: "one-off",
        recurrenceEndDate: null,
        recurrenceDayOfWeek: null,
        recurrencePattern: "date",
        recurrenceDateOfMonth: 1,
        recurrenceDayOfMonth: 1,
        recurrenceDayOfWeekMonthly: 3,
        visibility: getDefaultVisibility(),
        groupIds: [],
      });

      setSubmitting(false);
      return true;
    } catch (err) {
      console.error("Error submitting event form:", err);
      setError(err.message);
      setSubmitting(false);
      return false;
    }
  };

  return {
    formData,
    updateForm,
    submitForm,
    submitting,
    error,
  };
}
