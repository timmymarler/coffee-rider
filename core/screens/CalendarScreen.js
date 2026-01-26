// core/screens/CalendarScreen.js
import { AuthContext } from "@context/AuthContext";
import { useEvents } from "@core/hooks/useEvents";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REGIONS = [
  "South West",
  "South East",
  "London",
  "West Midlands",
  "East Midlands",
  "East of England",
  "North West",
  "North East",
  "Yorkshire and the Humber",
  "Wales",
  "Scotland",
  "Northern Ireland",
];

export default function CalendarScreen() {
  const router = useRouter();
  const { user, profile } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const { colors, spacing } = theme;

  const [viewMode, setViewMode] = useState("month"); // "month", "week", "day"
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState({
    regions: [],
    suitability: [], // Bikes, Scooters, Cars
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Memoize the useEvents filter to avoid unnecessary refetches
  const useEventsFilter = useMemo(
    () => ({ regions: filters.regions, _refresh: refreshTrigger }),
    [filters.regions, refreshTrigger]
  );

  // Only pass regions to useEvents - suitability will be filtered client-side
  const { events: allEvents, loading, deleteEvent, deleteEventSeries } = useEvents(useEventsFilter);

  // Filter events by suitability client-side
  const events = useMemo(() => {
    return allEvents.filter((event) => {
      if (filters.suitability.length === 0) return true;
      if (!event.suitability || event.suitability.length === 0) return true;
      return filters.suitability.some((suit) => event.suitability.includes(suit));
    });
  }, [allEvents, filters.suitability]);

  const filtersActive = filters.regions.length > 0 || filters.suitability.length > 0;

  useFocusEffect(
    useCallback(() => {
      // Refresh events when screen comes into focus
      // This ensures newly created events appear after navigating back from CreateEventScreen
      setRefreshTrigger(prev => prev + 1);
    }, [])
  );

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date) => {
    return events.filter((event) => {
      if (!event.startDateTime) return false;
      
      // Handle Firestore Timestamp objects
      let eventDate;
      if (event.startDateTime.toDate && typeof event.startDateTime.toDate === 'function') {
        // It's a Firestore Timestamp
        eventDate = event.startDateTime.toDate();
      } else if (event.startDateTime instanceof Date) {
        eventDate = event.startDateTime;
      } else if (typeof event.startDateTime === 'string') {
        eventDate = new Date(event.startDateTime);
      } else if (typeof event.startDateTime === 'number') {
        eventDate = new Date(event.startDateTime);
      } else {
        console.warn('Unknown startDateTime type:', typeof event.startDateTime, event.startDateTime);
        return false;
      }
      
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const renderCalendarGrid = () => {
    const daysInMonth = getDaysInMonth(selectedDate);
    const firstDayOfMonth = getFirstDayOfMonth(selectedDate);
    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Day headers
    const dayHeaders = dayNames.map((day) => (
      <View key={day} style={[styles.calendarCell, styles.dayHeader]}>
        <Text style={styles.dayHeaderText}>{day}</Text>
      </View>
    ));

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <View key={`empty-${i}`} style={styles.calendarCell}>
          <Text></Text>
        </View>
      );
    }

    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i);
      const dayEvents = getEventsForDate(date);
      const isToday =
        date.toDateString() === new Date().toDateString();
      const isSelected =
        date.toDateString() === selectedDate.toDateString();

      days.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.calendarCell,
            isSelected && styles.calendarCellSelected,
            isToday && !isSelected && styles.calendarCellToday,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <View style={styles.calendarCellContent}>
            <Text
              style={[
                styles.calendarDay,
                isSelected && styles.calendarDaySelected,
                isToday && !isSelected && styles.calendarDayToday,
              ]}
            >
              {i}
            </Text>
            {dayEvents.length > 0 && (
              <View style={styles.eventDot}>
                <Text style={styles.eventDotText}>{dayEvents.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return [dayHeaders, ...days];
  };

  const renderWeekView = () => {
    // Get the start of the week (Sunday)
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
    
    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Day headers
    const dayHeaders = dayNames.map((day) => (
      <View key={day} style={[styles.weekCell, styles.dayHeader]}>
        <Text style={styles.dayHeaderText}>{day}</Text>
      </View>
    ));

    // Days of week
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayEvents = getEventsForDate(date);
      const isToday = date.toDateString() === new Date().toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();

      days.push(
        <TouchableOpacity
          key={i}
          style={[
            styles.weekCell,
            isSelected && styles.calendarCellSelected,
            isToday && !isSelected && styles.calendarCellToday,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text
            style={[
              styles.weekDayNum,
              isSelected && styles.calendarDaySelected,
              isToday && !isSelected && styles.calendarDayToday,
            ]}
          >
            {date.getDate()}
          </Text>
          {dayEvents.length > 0 && (
            <View style={styles.weekEventDot}>
              <Text style={styles.eventDotText}>{dayEvents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return [dayHeaders, ...days];
  };

  const renderEventsList = () => {
    const dayEvents = getEventsForDate(selectedDate);

    if (loading) {
      return <ActivityIndicator size="large" color={colors.accentMid} />;
    }

    if (dayEvents.length === 0) {
      return (
        <View style={styles.noEventsContainer}>
          <Text style={styles.noEventsText}>No events on this day</Text>
        </View>
      );
    }

    return (
      <View>
        {dayEvents.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.eventCard}
            onPress={() => {
              setSelectedEvent(item);
              setShowEventModal(true);
            }}
          >
            <View style={styles.eventTime}>
              <Text style={styles.eventTimeText}>
                {(() => {
                  let eventDate;
                  if (item.startDateTime.toDate && typeof item.startDateTime.toDate === 'function') {
                    eventDate = item.startDateTime.toDate();
                  } else if (item.startDateTime instanceof Date) {
                    eventDate = item.startDateTime;
                  } else {
                    eventDate = new Date(item.startDateTime);
                  }
                  return eventDate.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                })()}
              </Text>
            </View>
            <View style={styles.eventDetails}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventPlace}>{item.placeName}</Text>
              <View style={styles.eventMeta}>
                {item.suitability && item.suitability.length > 0 && (
                  <Text style={styles.eventSuitability}>
                    {item.suitability.join(", ")}
                  </Text>
                )}
                {item.attendees && (
                  <Text style={styles.eventAttendees}>
                    {item.attendees.length} attending
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const handleRegionToggle = (region) => {
    setFilters((prev) => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter((r) => r !== region)
        : [...prev.regions, region],
    }));
  };

  const handleSuitabilityToggle = (suitability) => {
    setFilters((prev) => ({
      ...prev,
      suitability: prev.suitability.includes(suitability)
        ? prev.suitability.filter((s) => s !== suitability)
        : [...prev.suitability, suitability],
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerControls, { paddingTop: 12, paddingRight: insets.top + 12 }]}>
          <View style={styles.viewToggle}>
            {["month", "week", "day"].map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.viewButton,
                  viewMode === mode && styles.viewButtonActive,
                ]}
                onPress={() => setViewMode(mode)}
              >
                <Text
                  style={[
                    styles.viewButtonText,
                    viewMode === mode && styles.viewButtonTextActive,
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options"
              size={24}
              color={filtersActive ? colors.accentMid : colors.primaryLight}
            />
          </TouchableOpacity>
        </View>

      {showFilters && (
        <ScrollView
          style={styles.filtersPanel}
          contentContainerStyle={styles.filtersPanelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.filterTitle}>Regions</Text>
          <View style={styles.iconGrid}>
            {REGIONS.map((region) => {
              const active = filters.regions.includes(region);
              return (
                <TouchableOpacity
                  key={region}
                  style={[
                    styles.iconButton,
                    active && styles.iconButtonActive,
                  ]}
                  onPress={() => handleRegionToggle(region)}
                >
                  <Text
                    style={[
                      styles.iconLabel,
                      active && styles.iconLabelActive,
                    ]}
                  >
                    {region}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterTitle, { marginTop: spacing.md }]}>Suitability</Text>
          <View style={styles.iconGrid}>
            {["Bikes", "Scooters", "Cars"].map((suitability) => {
              const active = filters.suitability.includes(suitability);
              return (
                <TouchableOpacity
                  key={suitability}
                  style={[
                    styles.iconButton,
                    active && styles.iconButtonActive,
                  ]}
                  onPress={() => handleSuitabilityToggle(suitability)}
                >
                  <Text
                    style={[
                      styles.iconLabel,
                      active && styles.iconLabelActive,
                    ]}
                  >
                    {suitability}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.xl * 5 }}
      >
        {/* Month Header */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => {
              const prev = new Date(selectedDate);
              prev.setMonth(prev.getMonth() - 1);
              setSelectedDate(prev);
            }}
          >
            <Text style={styles.monthHeaderButton}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.monthHeaderTitle}>
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <TouchableOpacity
            onPress={() => {
              const next = new Date(selectedDate);
              next.setMonth(next.getMonth() + 1);
              setSelectedDate(next);
            }}
          >
            <Text style={styles.monthHeaderButton}>Next →</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        {viewMode === "month" && (
          <View style={styles.calendarGrid}>
            {renderCalendarGrid()}
          </View>
        )}

        {/* Week View */}
        {viewMode === "week" && (
          <View style={styles.weekGrid}>
            {renderWeekView()}
          </View>
        )}

        {/* Selected Date Events */}
        <View style={styles.eventsSection}>
          <Text style={styles.selectedDateTitle}>
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </Text>
          {renderEventsList()}
        </View>

        {/* Create Event Button (for place owners & pro users) */}
        {profile?.role === "place-owner" || profile?.role === "pro" ? (
          <TouchableOpacity
            style={styles.createEventButton}
            onPress={() => router.push({
              pathname: "/create-event",
              params: { selectedDate: selectedDate.toISOString() }
            })}
          >
            <Text style={styles.createEventButtonText}>+ Create Event</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Event Details Modal */}
      <Modal
        visible={showEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={styles.eventModalOverlay}>
          <View style={styles.eventModalContent}>
            {selectedEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with close button */}
                <View style={styles.eventModalHeader}>
                  <Text style={styles.eventModalTitle}>{selectedEvent.title}</Text>
                  <TouchableOpacity onPress={() => setShowEventModal(false)}>
                    <Ionicons name="close" size={28} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Event details */}
                <View style={styles.eventModalSection}>
                  <Text style={styles.eventModalLabel}>Place</Text>
                  <Text style={styles.eventModalValue}>{selectedEvent.placeName}</Text>
                </View>

                {selectedEvent.startDateTime && (
                  <View style={styles.eventModalSection}>
                    <Text style={styles.eventModalLabel}>Date & Time</Text>
                    <Text style={styles.eventModalValue}>
                      {(() => {
                        let eventDate;
                        if (selectedEvent.startDateTime.toDate && typeof selectedEvent.startDateTime.toDate === 'function') {
                          eventDate = selectedEvent.startDateTime.toDate();
                        } else if (selectedEvent.startDateTime instanceof Date) {
                          eventDate = selectedEvent.startDateTime;
                        } else {
                          eventDate = new Date(selectedEvent.startDateTime);
                        }
                        return eventDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        });
                      })()}
                    </Text>
                  </View>
                )}

                {selectedEvent.region && (
                  <View style={styles.eventModalSection}>
                    <Text style={styles.eventModalLabel}>Region</Text>
                    <Text style={styles.eventModalValue}>{selectedEvent.region}</Text>
                  </View>
                )}

                {selectedEvent.suitability && selectedEvent.suitability.length > 0 && (
                  <View style={styles.eventModalSection}>
                    <Text style={styles.eventModalLabel}>Suitability</Text>
                    <Text style={styles.eventModalValue}>{selectedEvent.suitability.join(", ")}</Text>
                  </View>
                )}

                {selectedEvent.attendees && (
                  <View style={styles.eventModalSection}>
                    <Text style={styles.eventModalLabel}>Attendees</Text>
                    <Text style={styles.eventModalValue}>{selectedEvent.attendees.length} people</Text>
                  </View>
                )}

                {selectedEvent.description && (
                  <View style={styles.eventModalSection}>
                    <Text style={styles.eventModalLabel}>Description</Text>
                    <Text style={styles.eventModalValue}>{selectedEvent.description}</Text>
                  </View>
                )}

                {/* Delete button for event owners */}
                {(profile?.role === "place-owner" || profile?.role === "pro" || selectedEvent.createdBy === user?.uid) && (
                  <TouchableOpacity
                    style={styles.deleteEventButton}
                    onPress={() => {
                      // Check if this is part of a series
                      const isSeriesEvent = selectedEvent.seriesId && selectedEvent.recurrence && selectedEvent.recurrence !== "one-off";
                      
                      if (isSeriesEvent) {
                        Alert.alert(
                          "Delete Event",
                          "Delete this event or the entire series?",
                          [
                            { text: "Cancel", onPress: () => {} },
                            {
                              text: "Delete This Event",
                              onPress: async () => {
                                try {
                                  await deleteEvent(selectedEvent.id);
                                  setShowEventModal(false);
                                  setRefreshTrigger(prev => prev + 1);
                                } catch (error) {
                                  Alert.alert("Error", "Failed to delete event. Please try again.");
                                  console.error("Delete error:", error);
                                }
                              },
                            },
                            {
                              text: "Delete Series",
                              onPress: async () => {
                                try {
                                  await deleteEventSeries(selectedEvent.seriesId);
                                  setShowEventModal(false);
                                  setRefreshTrigger(prev => prev + 1);
                                } catch (error) {
                                  Alert.alert("Error", "Failed to delete series. Please try again.");
                                  console.error("Delete series error:", error);
                                }
                              },
                              style: "destructive",
                            },
                          ]
                        );
                      } else {
                        Alert.alert(
                          "Delete Event",
                          "Are you sure you want to delete this event?",
                          [
                            { text: "Cancel", onPress: () => {} },
                            {
                              text: "Delete",
                              onPress: async () => {
                                try {
                                  await deleteEvent(selectedEvent.id);
                                  setShowEventModal(false);
                                  setRefreshTrigger(prev => prev + 1);
                                } catch (error) {
                                  Alert.alert("Error", "Failed to delete event. Please try again.");
                                  console.error("Delete error:", error);
                                }
                              },
                              style: "destructive",
                            },
                          ]
                        );
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can" size={20} color={colors.danger} />
                    <Text style={styles.deleteEventButtonText}>Delete Event</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.colors.text,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: "transparent",
  },
  filterButton: {
    width: 52,
    height: 52,
    marginLeft: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryDark,
    shadowColor: theme.colors.accentMid,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },
  filtersPanel: {
    maxHeight: "70%",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.primaryDark,
  },
  filtersPanelContent: {
    paddingBottom: theme.spacing.xl,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.accentMid,
    marginBottom: 12,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  iconButton: {
    width: "48%",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceMuted,
  },
  iconButtonActive: {
    backgroundColor: theme.colors.surfaceHighlight,
  },
  iconLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.accentDark,
    textAlign: "center",
  },
  iconLabelActive: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  viewToggle: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  viewButton: {
    width: 52,
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primaryDark,
  },
  viewButtonActive: {
    backgroundColor: theme.colors.accentMid,
    borderColor: theme.colors.accentMid,
  },
  viewButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.textMuted,
  },
  viewButtonTextActive: {
    color: theme.colors.primaryDark,
  },
  monthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  monthHeaderButton: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.accentMid,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  calendarCell: {
    width: "14.285714%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
  },
  calendarCellContent: {
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  dayHeader: {
    backgroundColor: theme.colors.primaryMid,
    borderColor: theme.colors.primaryMid,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  calendarCellToday: {
    backgroundColor: theme.colors.accentDark,
  },
  calendarCellSelected: {
    backgroundColor: theme.colors.accentMid,
  },
  calendarDay: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  calendarDayToday: {
    color: theme.colors.primaryDark,
    fontWeight: "700",
  },
  calendarDaySelected: {
    color: theme.colors.primaryDark,
    fontWeight: "700",
  },
  eventDot: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 3,
    minWidth: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  eventDotText: {
    fontSize: 8,
    fontWeight: "700",
    color: "white",
  },
  eventsSection: {
    marginBottom: theme.spacing.lg,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  noEventsContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: "center",
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noEventsText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  eventCard: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentMid,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  eventTime: {
    marginRight: 12,
    justifyContent: "center",
    minWidth: 55,
  },
  eventTimeText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.accentMid,
  },
  eventDetails: {
    flex: 1,
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 4,
  },
  eventPlace: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: "row",
    gap: 12,
  },
  eventSuitability: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.accentMid,
  },
  eventAttendees: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.textMuted,
  },
  createEventButton: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    paddingVertical: 14,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  createEventButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.primaryDark,
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  weekCell: {
    width: "14.285714%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "transparent",
    paddingVertical: 8,
  },
  weekDayNum: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
  },
  weekEventDot: {
    marginTop: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 2,
    minWidth: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  eventModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  eventModalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    maxHeight: "85%",
  },
  eventModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.text,
    flex: 1,
  },
  eventModalSection: {
    marginBottom: theme.spacing.lg,
  },
  eventModalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.textMuted,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  eventModalValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "500",
  },
  deleteEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: 8,
    marginTop: theme.spacing.lg,
  },
  deleteEventButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.danger,
    marginLeft: 8,
  },});