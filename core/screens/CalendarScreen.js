// core/screens/CalendarScreen.js
import { AuthContext } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { useEvents } from "@core/hooks/useEvents";
import { EVENT_VISIBILITY, shareEvent } from "@core/map/events/sharedEvents";
import { getCapabilities } from "@core/roles/capabilities";
// Remove DropDownPicker import
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import theme from "@themes";
import { useRouter } from "expo-router";
import { useCallback, useContext, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    PanResponder,
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
    // PanResponder for swipe gestures
    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
      },
      onStartShouldSetPanResponderCapture: (evt, gestureState) => {
        // Only capture if it's a horizontal swipe, not a tap
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 20;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -40) {
          // Swipe left: next month
          const next = new Date(selectedDate);
          next.setMonth(next.getMonth() + 1);
          setSelectedDate(next);
        } else if (gestureState.dx > 40) {
          // Swipe right: previous month
          const prev = new Date(selectedDate);
          prev.setMonth(prev.getMonth() - 1);
          setSelectedDate(prev);
        }
      },
    });
  const router = useRouter();
  const { user, profile } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  // Use dynamic theme from context
  const dynamicTheme = useTheme();
  const theme = dynamicTheme;
  const { colors, spacing } = theme;
  const capabilities = getCapabilities(profile?.role || "guest");

  // Only month view needed
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState({
    regions: [],
    suitability: [], // Bikes, Scooters, Cars
    sharing: [], // Private, Group, Public
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Share event modal state
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedVisibility, setSelectedVisibility] = useState(EVENT_VISIBILITY.PRIVATE);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [groupCardExpanded, setGroupCardExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Memoize the useEvents filter to avoid unnecessary refetches
  const useEventsFilter = useMemo(
    () => ({ regions: filters.regions, _refresh: refreshTrigger }),
    [filters.regions, refreshTrigger]
  );

  // Only pass regions to useEvents - suitability will be filtered client-side
  const { events: allEvents, loading, deleteEvent, deleteEventSeries } = useEvents(useEventsFilter);

  // Load user's groups for share modal
  const { groups } = useAllUserGroups(user?.uid);

  // Filter events by suitability and sharing client-side
  const events = useMemo(() => {
    return allEvents.filter((event) => {
      // Filter by suitability
      if (filters.suitability.length > 0) {
        if (!event.suitability || event.suitability.length === 0) {
          return false;
        }
        if (!filters.suitability.some((suit) => event.suitability.includes(suit))) {
          return false;
        }
      }

      // Filter by sharing/visibility
      if (filters.sharing.length > 0) {
        const eventVisibility = event.visibility || "private";
        if (!filters.sharing.includes(eventVisibility)) {
          return false;
        }
      }

      return true;
    });
  }, [allEvents, filters.suitability, filters.sharing]);

  const filtersActive = filters.regions.length > 0 || filters.suitability.length > 0 || filters.sharing.length > 0;

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

  const handleShareEvent = async () => {
    if (!selectedEvent) return;
    try {
      setSharing(true);
      if (selectedVisibility === EVENT_VISIBILITY.GROUP) {
        if (!selectedGroupIds.length) {
          Alert.alert("Select at least one group");
          return;
        }
        await shareEvent({
          eventId: selectedEvent.id,
          visibility: selectedVisibility,
          groupId: selectedGroupIds, // Pass array of group IDs
          capabilities,
          userId: user?.uid,
        });
      } else {
        await shareEvent({
          eventId: selectedEvent.id,
          visibility: selectedVisibility,
          groupId: null,
          capabilities,
          userId: user?.uid,
        });
      }
      Alert.alert("Success", "Event shared successfully!");
      setShareModalVisible(false);
      setSelectedVisibility(EVENT_VISIBILITY.PRIVATE);
      setSelectedGroupIds([]);
    } catch (err) {
      console.error("Error sharing event:", err);
      let errorMessage = "Failed to share event. Please try again.";
      if (err.message?.includes("own events")) {
        errorMessage = "You can only share events you created.";
      } else if (err.message?.includes("canShareEvents")) {
        errorMessage = "You don't have permission to share events.";
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setSharing(false);
    }
  };

  const openShareModal = () => {
    if (!selectedEvent) return;
    // Pre-populate visibility if the event already has one
    if (selectedEvent.visibility) {
      setSelectedVisibility(selectedEvent.visibility);
      if (selectedEvent.visibility === EVENT_VISIBILITY.GROUP) {
        if (Array.isArray(selectedEvent.groupIds)) {
          setSelectedGroupIds(selectedEvent.groupIds);
        } else if (selectedEvent.groupId) {
          setSelectedGroupIds([selectedEvent.groupId]);
        } else {
          setSelectedGroupIds([]);
        }
      }
    }
    setShareModalVisible(true);
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
      <View key={day} style={[dynamicStyles.calendarCell, dynamicStyles.dayHeader]}>
        <Text style={dynamicStyles.dayHeaderText}>{day}</Text>
      </View>
    ));

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <View key={`empty-${i}`} style={dynamicStyles.calendarCell}>
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
            dynamicStyles.calendarCell,
            isSelected && dynamicStyles.calendarCellSelected,
            isToday && !isSelected && dynamicStyles.calendarCellToday,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <View style={dynamicStyles.calendarCellContent}>
            <Text
              style={[
                dynamicStyles.calendarDay,
                isSelected && dynamicStyles.calendarDaySelected,
                isToday && !isSelected && dynamicStyles.calendarDayToday,
              ]}
            >
              {i}
            </Text>
            {dayEvents.length > 0 && (
              <View style={[dynamicStyles.eventDot, isSelected && dynamicStyles.eventDotSelected]}>
                <Text style={[dynamicStyles.eventDotText, isSelected && dynamicStyles.eventDotTextSelected]}>{dayEvents.length}</Text>
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
      <View key={day} style={[dynamicStyles.weekCell, dynamicStyles.dayHeader]}>
        <Text style={dynamicStyles.dayHeaderText}>{day}</Text>
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
            dynamicStyles.weekCell,
            isSelected && dynamicStyles.calendarCellSelected,
            isToday && !isSelected && dynamicStyles.calendarCellToday,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text
            style={[
              dynamicStyles.weekDayNum,
              isSelected && dynamicStyles.calendarDaySelected,
              isToday && !isSelected && dynamicStyles.calendarDayToday,
            ]}
          >
            {date.getDate()}
          </Text>
          {dayEvents.length > 0 && (
            <View style={dynamicStyles.weekEventDot}>
              <Text style={dynamicStyles.eventDotText}>{dayEvents.length}</Text>
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
        <View style={dynamicStyles.noEventsContainer}>
          <Text style={dynamicStyles.noEventsText}>No events on this day</Text>
        </View>
      );
    }

    return (
      <View>
        {dayEvents.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={dynamicStyles.eventCard}
            onPress={() => {
              // Only the creator can edit the event
              const isCreator = item.createdBy === user?.uid || item.userId === user?.uid;
              if (isCreator) {
                router.push({
                  pathname: '/create-event',
                  params: { eventId: item.id, edit: 'true' }
                });
              } else {
                setSelectedEvent(item);
                setShowEventModal(true);
              }
            }}
          >
            <View style={dynamicStyles.eventTime}>
              <Text style={dynamicStyles.eventTimeText}>
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
            <View style={dynamicStyles.eventDetails}>
              <Text style={dynamicStyles.eventTitle}>{item.title}</Text>
              <Text style={dynamicStyles.eventPlace}>{item.placeName}</Text>
              <View style={dynamicStyles.eventMeta}>
                {item.suitability && item.suitability.length > 0 && (
                  <Text style={dynamicStyles.eventSuitability}>
                    {item.suitability.join(", ")}
                  </Text>
                )}
                {item.attendees && (
                  <Text style={dynamicStyles.eventAttendees}>
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

  const handleSharingToggle = (sharing) => {
    setFilters((prev) => ({
      ...prev,
      sharing: prev.sharing.includes(sharing)
        ? prev.sharing.filter((s) => s !== sharing)
        : [...prev.sharing, sharing],
    }));
  };

  // Helper to convert hex color to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Create theme-aware styles inside component so they update when theme changes
  const dynamicStyles = StyleSheet.create({
    headerNavButtonLarge: {
      width: 52,
      height: 52,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryDark,
      marginHorizontal: 2,
      shadowColor: theme.colors.accentMid,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    headerNavButtonTextLarge: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.colors.accentMid,
    },
    container: {
      flex: 1,
    },
    headerControls: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.primaryMid,
    },
    headerTodayButton: {
      minWidth: 80,
      height: 52,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primaryDark,
      marginHorizontal: 2,
      paddingHorizontal: 12,
      shadowColor: theme.colors.accentMid,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    filterButton: {
      width: 52,
      height: 52,
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
    filtersPanel: {
      maxHeight: "70%",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.primaryDark,
    },
    monthHeaderTitleBar: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      backgroundColor: theme.colors.primaryDark,
      borderRadius: 12,
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      width: '100%',
    },
    calendarWrapper: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 16,
    },
    calendarGrid: {
      borderRadius: 12,
      overflow: 'hidden',
    },
    dayHeader: {
      backgroundColor: theme.colors.primaryDark,
    },
    dayHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
    },
    calendarCell: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primaryDark,
    },
    weekCell: {
      flex: 1,
      aspectRatio: 1.5,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.primaryDark,
    },
    calendarCellContent: {
      alignItems: 'center',
    },
    calendarDay: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    calendarDaySelected: {
      color: theme.colors.primaryDark,
      fontWeight: '700',
    },
    calendarDayToday: {
      color: theme.colors.accentMid,
      fontWeight: '700',
    },
    calendarCellSelected: {
      backgroundColor: theme.colors.accentMid,
    },
    calendarCellToday: {
      borderWidth: 2,
      borderColor: theme.colors.accentMid,
    },
    eventDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.3),
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventDotSelected: {
      backgroundColor: theme.colors.primaryDark,
    },
    eventDotText: {
      fontSize: 8,
      fontWeight: '700',
      color: theme.colors.accentMid,
    },
    eventDotTextSelected: {
      color: theme.colors.accentMid,
    },
    filtersPanelContent: {
      paddingBottom: theme.spacing.xl,
    },
    filterGroup: {
      marginBottom: theme.spacing.md,
    },
    filterGroupTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: theme.spacing.sm,
      letterSpacing: 0.5,
    },
    filterOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
    filterPill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    filterPillActive: {
      backgroundColor: theme.colors.accentMid,
      borderColor: theme.colors.accentMid,
    },
    filterPillText: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    filterPillTextActive: {
      color: theme.colors.primaryDark,
      fontWeight: '700',
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.accentMid,
    },
    eventRow: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    eventTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.accentMid,
      marginBottom: 4,
    },
    eventMeta: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    eventSuitability: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    eventAttendees: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.colors.textMuted,
    },
    noEventsContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl * 2,
      backgroundColor: theme.colors.primaryDark,
    },
    createEventButton: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.accentMid,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    createEventButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primaryDark,
    },
    modalButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.accentMid,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primaryDark,
    },
    deleteEventButton: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteEventButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#ffffff',
      marginLeft: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingTop: 24,
      paddingBottom: 32,
      maxHeight: '75%',
      width: '85%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text,
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.colors.textMuted,
      paddingHorizontal: 20,
      marginBottom: 16,
    },
    optionsContainer: {
      paddingHorizontal: 20,
      marginBottom: 16,
      maxHeight: 400,
    },
    visibilityOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    visibilityOptionSelected: {
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.1),
      borderColor: theme.colors.accentMid,
    },
    optionTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    optionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.text,
    },
    optionDesc: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 2,
    },
    groupSelector: {
      marginLeft: 32,
      marginTop: 8,
      marginBottom: 12,
      gap: 6,
    },
    groupOption: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    groupOptionSelected: {
      backgroundColor: hexToRgba(theme.colors.accentMid, 0.15),
      borderColor: theme.colors.accentMid,
    },
    groupOptionText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.colors.text,
    },
    groupOptionTextSelected: {
      color: theme.colors.accentMid,
      fontWeight: '600',
    },
    noGroupsText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      fontStyle: 'italic',
      marginLeft: 32,
      marginBottom: 12,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
    },
    cancelButton: {
      backgroundColor: theme.colors.primaryDark,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      color: theme.colors.text,
    },
  });

  return (
    <View style={[dynamicStyles.container, { backgroundColor: colors.background }]}>
      <View style={[dynamicStyles.headerControls, { paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: insets.top + 12 }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={dynamicStyles.headerNavButtonLarge} 
              onPress={() => {
                const prev = new Date(selectedDate);
                prev.setMonth(prev.getMonth() - 1);
                setSelectedDate(prev);
              }}
              activeOpacity={0.8}
            >
              <Text style={dynamicStyles.headerNavButtonTextLarge}>{'<'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dynamicStyles.headerTodayButton}
              onPress={() => setSelectedDate(new Date())}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.accentMid }}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={dynamicStyles.headerNavButtonLarge}
              onPress={() => {
                const next = new Date(selectedDate);
                next.setMonth(next.getMonth() + 1);
                setSelectedDate(next);
              }}
              activeOpacity={0.8}
            >
              <Text style={dynamicStyles.headerNavButtonTextLarge}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={dynamicStyles.filterButton} 
            onPress={() => setShowFilters(!showFilters)} 
            activeOpacity={0.8} 
          > 
            <Ionicons 
              name="options" 
              size={28} 
              color={filtersActive ? colors.accentMid : colors.primaryLight} 
            /> 
          </TouchableOpacity> 
        </View>
      </View>

      {showFilters && (
        <ScrollView
          style={dynamicStyles.filtersPanel}
          contentContainerStyle={dynamicStyles.filtersPanelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={dynamicStyles.filterTitle}>Sharing</Text>
          <View style={dynamicStyles.iconGrid}>
            {["private", "group", "public"].map((sharingType) => {
              const active = filters.sharing.includes(sharingType);
              const displayName = sharingType.charAt(0).toUpperCase() + sharingType.slice(1);
              return (
                <TouchableOpacity
                  key={sharingType}
                  style={[
                    dynamicStyles.iconButton,
                    active && dynamicStyles.iconButtonActive,
                  ]}
                  onPress={() => handleSharingToggle(sharingType)}
                >
                  <Text
                    style={[
                      dynamicStyles.iconLabel,
                      active && dynamicStyles.iconLabelActive,
                    ]}
                  >
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[dynamicStyles.filterTitle, { marginTop: spacing.md }]}>Regions</Text>
          <View style={dynamicStyles.iconGrid}>
            {REGIONS.map((region) => {
              const active = filters.regions.includes(region);
              return (
                <TouchableOpacity
                  key={region}
                  style={[
                    dynamicStyles.iconButton,
                    active && dynamicStyles.iconButtonActive,
                  ]}
                  onPress={() => handleRegionToggle(region)}
                >
                  <Text
                    style={[
                      dynamicStyles.iconLabel,
                      active && dynamicStyles.iconLabelActive,
                    ]}
                  >
                    {region}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[dynamicStyles.filterTitle, { marginTop: spacing.md }]}>Suitability</Text>
          <View style={dynamicStyles.iconGrid}>
            {["Bikes", "Scooters", "Cars"].map((suitability) => {
              const active = filters.suitability.includes(suitability);
              return (
                <TouchableOpacity
                  key={suitability}
                  style={[
                    dynamicStyles.iconButton,
                    active && dynamicStyles.iconButtonActive,
                  ]}
                  onPress={() => handleSuitabilityToggle(suitability)}
                >
                  <Text
                    style={[
                      dynamicStyles.iconLabel,
                      active && dynamicStyles.iconLabelActive,
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

      <View style={{ flex: 1 }}>
        <ScrollView
          style={dynamicStyles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl * 5 }}
        >
          {/* Month Title in place of old header */}
          <View style={dynamicStyles.monthHeaderTitleBar}>
            <Text style={dynamicStyles.monthHeaderTitle}>
              {selectedDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          {/* Calendar Grid (always month view) */}
          <View style={dynamicStyles.calendarGrid} pointerEvents="box-none" {...panResponder.panHandlers}>
            {renderCalendarGrid()}
          </View>

          {/* Selected Date Events */}
          <View style={dynamicStyles.eventsSection}>
            <Text style={dynamicStyles.selectedDateTitle}>
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Text>
            {renderEventsList()}
          </View>

          {/* Create Event Button (for users with canCreateEvents capability) */}
          {capabilities?.canCreateEvents ? (
            <TouchableOpacity
              style={dynamicStyles.createEventButton}
              onPress={() => router.push({
                pathname: "/create-event",
                params: { selectedDate: selectedDate.toISOString() }
              })}
            >
              <Text style={dynamicStyles.createEventButtonText}>+ Create Event</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      {/* Event Details Modal */}
      <Modal
        visible={showEventModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={dynamicStyles.eventModalOverlay}>
          <View style={dynamicStyles.eventModalContent}>
            {selectedEvent && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with close button */}
                <View style={dynamicStyles.eventModalHeader}>
                  <Text style={dynamicStyles.eventModalTitle}>{selectedEvent.title}</Text>
                  <TouchableOpacity onPress={() => setShowEventModal(false)}>
                    <Ionicons name="close" size={28} color={theme.colors.accentMid} />
                  </TouchableOpacity>
                </View>

                {/* Subtitle with place name, now white, with location icon and link */}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                  disabled={!selectedEvent.placeId}
                  onPress={() => {
                    if (selectedEvent.placeId) {
                      router.push({
                        pathname: '/map',
                        params: { placeId: selectedEvent.placeId, openPlaceCard: true }
                      });
                    }
                  }}
                >
                  <MaterialCommunityIcons name="map-marker" size={18} color={theme.colors.text} style={{ marginRight: 6 }} />
                  <Text style={{ color: theme.colors.text, fontSize: 14 }}>
                    {selectedEvent.placeName || 'No location'}
                  </Text>
                </TouchableOpacity>

                {/* Event details */}
                <View style={dynamicStyles.eventModalSection}>
                  <Text style={dynamicStyles.eventModalLabel}>Place</Text>
                  <Text style={dynamicStyles.eventModalValue}>{selectedEvent.placeName}</Text>
                </View>

                {selectedEvent.startDateTime && (
                  <View style={dynamicStyles.eventModalSection}>
                    <Text style={dynamicStyles.eventModalLabel}>Date & Time</Text>
                    <Text style={dynamicStyles.eventModalValue}>
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
                  <View style={dynamicStyles.eventModalSection}>
                    <Text style={dynamicStyles.eventModalLabel}>Region</Text>
                    <Text style={dynamicStyles.eventModalValue}>{selectedEvent.region}</Text>
                  </View>
                )}

                {selectedEvent.suitability && selectedEvent.suitability.length > 0 && (
                  <View style={dynamicStyles.eventModalSection}>
                    <Text style={dynamicStyles.eventModalLabel}>Suitability</Text>
                    <Text style={dynamicStyles.eventModalValue}>{selectedEvent.suitability.join(", ")}</Text>
                  </View>
                )}

                {selectedEvent.attendees && (
                  <View style={dynamicStyles.eventModalSection}>
                    <Text style={dynamicStyles.eventModalLabel}>Attendees</Text>
                    <Text style={dynamicStyles.eventModalValue}>{selectedEvent.attendees.length} people</Text>
                  </View>
                )}

                {selectedEvent.description && (
                  <View style={dynamicStyles.eventModalSection}>
                    <Text style={dynamicStyles.eventModalLabel}>Description</Text>
                    <Text style={dynamicStyles.eventModalValue}>{selectedEvent.description}</Text>
                  </View>
                )}

                {/* Share button - only for event creator */}
                {selectedEvent.createdBy === user?.uid && (
                  <TouchableOpacity
                    style={dynamicStyles.shareEventButton}
                    onPress={openShareModal}
                  >
                    <Ionicons name="share-social" size={20} color={theme.colors.accentMid} />
                    <Text style={dynamicStyles.shareEventButtonText}>Share Event</Text>
                  </TouchableOpacity>
                )}

                {/* Delete button - only for event creator */}
                {selectedEvent.createdBy === user?.uid && (
                  <TouchableOpacity
                    style={dynamicStyles.deleteEventButton}
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
                    <Text style={dynamicStyles.deleteEventButtonText}>Delete Event</Text>
                  </TouchableOpacity>
                )}

                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Share Event Modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <Text style={dynamicStyles.modalTitle}>Share Event</Text>
            <Text style={dynamicStyles.modalSubtitle}>
              {selectedEvent?.title || "Untitled event"}
            </Text>

            <ScrollView style={dynamicStyles.optionsContainer}>
              {/* Private Option */}
              <TouchableOpacity
                style={[
                  dynamicStyles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.PRIVATE &&
                    dynamicStyles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(EVENT_VISIBILITY.PRIVATE)}
              >
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={
                    selectedVisibility === EVENT_VISIBILITY.PRIVATE
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Private</Text>
                  <Text style={dynamicStyles.optionDesc}>Only you can see this</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === EVENT_VISIBILITY.PRIVATE
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>

              {/* Group Option */}
              <TouchableOpacity
                style={[
                  dynamicStyles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.GROUP &&
                    dynamicStyles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(EVENT_VISIBILITY.GROUP)}
              >
                <MaterialCommunityIcons
                  name="account-multiple"
                  size={20}
                  color={
                    selectedVisibility === EVENT_VISIBILITY.GROUP
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Group</Text>
                  <Text style={dynamicStyles.optionDesc}>Share with a group</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === EVENT_VISIBILITY.GROUP
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>

              {selectedVisibility === EVENT_VISIBILITY.GROUP && groups?.length > 0 && (
                <View style={{ marginVertical: 12 }}>
                  <TouchableOpacity
                    style={{
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderWidth: 1,
                      borderRadius: 8,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    onPress={() => setGroupCardExpanded((prev) => !prev)}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '500' }}>
                      {selectedGroupIds.length === 0
                        ? 'Select groups...'
                        : `${selectedGroupIds.length} group${selectedGroupIds.length > 1 ? 's' : ''} selected`}
                    </Text>
                    <Ionicons
                      name={groupCardExpanded ? 'chevron-up' : 'chevron-down'}
                      size={22}
                      color={theme.colors.text}
                    />
                  </TouchableOpacity>
                  {groupCardExpanded && (
                    <View style={{ maxHeight: 400, marginTop: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
                      <ScrollView style={{ maxHeight: 400 }}>
                        {groups.map((group) => (
                          <TouchableOpacity
                            key={group.id}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border, justifyContent: 'space-between' }}
                            onPress={() => {
                              setSelectedGroupIds((selected) =>
                                selected.includes(group.id)
                                  ? selected.filter((id) => id !== group.id)
                                  : [...selected, group.id]
                              );
                            }}
                          >
                            <Text style={{ color: theme.colors.text, fontSize: 15 }}>{group.name}</Text>
                            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.accentMid, backgroundColor: selectedGroupIds.includes(group.id) ? theme.colors.accentMid : theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
                              {selectedGroupIds.includes(group.id) && (
                                <Ionicons name="checkmark" size={18} color={theme.colors.surface} />
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}

              {selectedVisibility === EVENT_VISIBILITY.GROUP && (!groups || groups.length === 0) && (
                <Text style={dynamicStyles.noGroupsText}>
                  No groups available. Create a group first.
                </Text>
              )}

              {/* Public Option */}
              <TouchableOpacity
                style={[
                  dynamicStyles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.PUBLIC &&
                    dynamicStyles.visibilityOptionSelected,
                ]}
                onPress={() => setSelectedVisibility(EVENT_VISIBILITY.PUBLIC)}
              >
                <Ionicons
                  name="globe"
                  size={20}
                  color={
                    selectedVisibility === EVENT_VISIBILITY.PUBLIC
                      ? theme.colors.accentMid
                      : theme.colors.text
                  }
                />
                <View style={dynamicStyles.optionTextContainer}>
                  <Text style={dynamicStyles.optionTitle}>Public</Text>
                  <Text style={dynamicStyles.optionDesc}>Anyone can see this</Text>
                </View>
                <Ionicons
                  name={
                    selectedVisibility === EVENT_VISIBILITY.PUBLIC
                      ? "radio-button-on"
                      : "radio-button-off"
                  }
                  size={20}
                  color={theme.colors.accentMid}
                />
              </TouchableOpacity>
            </ScrollView>

            <View style={dynamicStyles.buttonRow}>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, { backgroundColor: theme.colors.accentMid }]}
                onPress={handleShareEvent}
                disabled={sharing}
              >
                <Text style={dynamicStyles.modalButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.modalButton, dynamicStyles.cancelButton]}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={[dynamicStyles.modalButtonText, dynamicStyles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

