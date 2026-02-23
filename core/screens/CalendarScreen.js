// core/screens/CalendarScreen.js
import { AuthContext } from "@context/AuthContext";
import { useAllUserGroups } from "@core/groups/hooks";
import { useEvents } from "@core/hooks/useEvents";
import { EVENT_VISIBILITY, shareEvent } from "@core/map/events/sharedEvents";
import { deleteEvent as deleteEventUtil, deleteEventSeries as deleteEventSeriesUtil, recoverEvent } from "@core/map/events/deleteEvent";
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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
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
              <View style={[styles.eventDot, isSelected && styles.eventDotSelected]}>
                <Text style={[styles.eventDotText, isSelected && styles.eventDotTextSelected]}>{dayEvents.length}</Text>
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

  const handleSharingToggle = (sharing) => {
    setFilters((prev) => ({
      ...prev,
      sharing: prev.sharing.includes(sharing)
        ? prev.sharing.filter((s) => s !== sharing)
        : [...prev.sharing, sharing],
    }));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerControls, { paddingTop: 12, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingRight: insets.top + 12 }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              style={styles.headerNavButtonLarge} 
              onPress={() => {
                const prev = new Date(selectedDate);
                prev.setMonth(prev.getMonth() - 1);
                setSelectedDate(prev);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.headerNavButtonTextLarge}>{'<'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerTodayButton}
              onPress={() => setSelectedDate(new Date())}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.accentMid }}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerNavButtonLarge}
              onPress={() => {
                const next = new Date(selectedDate);
                next.setMonth(next.getMonth() + 1);
                setSelectedDate(next);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.headerNavButtonTextLarge}>{'>'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.filterButton} 
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
          style={styles.filtersPanel}
          contentContainerStyle={styles.filtersPanelContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.filterTitle}>Sharing</Text>
          <View style={styles.iconGrid}>
            {["private", "group", "public"].map((sharingType) => {
              const active = filters.sharing.includes(sharingType);
              const displayName = sharingType.charAt(0).toUpperCase() + sharingType.slice(1);
              return (
                <TouchableOpacity
                  key={sharingType}
                  style={[
                    styles.iconButton,
                    active && styles.iconButtonActive,
                  ]}
                  onPress={() => handleSharingToggle(sharingType)}
                >
                  <Text
                    style={[
                      styles.iconLabel,
                      active && styles.iconLabelActive,
                    ]}
                  >
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.filterTitle, { marginTop: spacing.md }]}>Regions</Text>
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

      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing.xl * 5 }}
        >
          {/* Month Title in place of old header */}
          <View style={styles.monthHeaderTitleBar}>
            <Text style={styles.monthHeaderTitle}>
              {selectedDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>

          {/* Calendar Grid (always month view) */}
          <View style={styles.calendarGrid} pointerEvents="box-none" {...panResponder.panHandlers}>
            {renderCalendarGrid()}
          </View>

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

          {/* Create Event Button (for users with canCreateEvents capability) */}
          {capabilities?.canCreateEvents ? (
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
      </View>

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

                {/* Share button - only for event creator */}
                {selectedEvent.createdBy === user?.uid && (
                  <TouchableOpacity
                    style={styles.shareEventButton}
                    onPress={openShareModal}
                  >
                    <Ionicons name="share-social" size={20} color={theme.colors.accentMid} />
                    <Text style={styles.shareEventButtonText}>Share Event</Text>
                  </TouchableOpacity>
                )}

                {/* Delete button - only for event creator */}
                {(() => {
                  const isCreator = selectedEvent.createdBy === user?.uid;
                  console.log('[CalendarScreen] Delete button check:', {
                    eventCreatedBy: selectedEvent?.createdBy,
                    userId: user?.uid,
                    isCreator,
                  });
                  return isCreator && (
                    <TouchableOpacity
                      style={styles.deleteEventButton}
                      onPress={() => {
                        setDeleteConfirmVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can" size={20} color={colors.danger} />
                      <Text style={styles.deleteEventButtonText}>Delete Event</Text>
                    </TouchableOpacity>
                  );
                })()}

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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Event</Text>
            <Text style={styles.modalSubtitle}>
              {selectedEvent?.title || "Untitled event"}
            </Text>

            <ScrollView style={styles.optionsContainer}>
              {/* Private Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.PRIVATE &&
                    styles.visibilityOptionSelected,
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
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Private</Text>
                  <Text style={styles.optionDesc}>Only you can see this</Text>
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
                  styles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.GROUP &&
                    styles.visibilityOptionSelected,
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
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Group</Text>
                  <Text style={styles.optionDesc}>Share with a group</Text>
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
                <Text style={styles.noGroupsText}>
                  No groups available. Create a group first.
                </Text>
              )}

              {/* Public Option */}
              <TouchableOpacity
                style={[
                  styles.visibilityOption,
                  selectedVisibility === EVENT_VISIBILITY.PUBLIC &&
                    styles.visibilityOptionSelected,
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
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Public</Text>
                  <Text style={styles.optionDesc}>Anyone can see this</Text>
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

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.accentMid }]}
                onPress={handleShareEvent}
                disabled={sharing}
              >
                <Text style={styles.modalButtonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Event Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete Event?</Text>
            <Text style={styles.confirmMessage}>
              This event will be deleted. You have 30 days to recover it.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.error }]}
                onPress={async () => {
                  if (!selectedEvent || !user?.uid) return;
                  setDeleting(true);
                  try {
                    const isSeriesEvent = selectedEvent.seriesId && selectedEvent.recurrence && selectedEvent.recurrence !== "one-off";
                    
                    if (isSeriesEvent) {
                      // For series, we need to find all events with this seriesId
                      // For now, just delete this event
                      await deleteEventUtil(selectedEvent.id, user.uid, capabilities?.isAdmin);
                    } else {
                      await deleteEventUtil(selectedEvent.id, user.uid, capabilities?.isAdmin);
                    }
                    
                    Alert.alert("Success", "Event deleted. You have 30 days to recover it.");
                    setDeleteConfirmVisible(false);
                    setShowEventModal(false);
                    setRefreshTrigger(prev => prev + 1);
                  } catch (error) {
                    Alert.alert("Error", error.message || "Failed to delete event");
                    console.error("Delete error:", error);
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
              >
                <Text style={styles.modalButtonText}>{deleting ? "Deleting…" : "Delete"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => !deleting && setDeleteConfirmVisible(false)}
                disabled={deleting}
              >
                <Text style={[styles.modalButtonText, styles.cancelButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  monthHeaderTitleBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: theme.colors.primaryMid,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    width: '100%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primaryMid,
    borderBottomWidth: 0,
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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.primaryMid,
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
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.primaryDark,
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
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  calendarCell: {
    width: "14.285714%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  calendarCellSelected: {
    backgroundColor: theme.colors.accentMid + "30",
  },
  calendarCellToday: {
    backgroundColor: theme.colors.primaryLight,
  },
  dayHeader: {
    backgroundColor: theme.colors.primaryMid,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.accentMid,
  },
  calendarCellContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarDay: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.text,
  },
  calendarDaySelected: {
    color: theme.colors.accentMid,
    fontWeight: "700",
  },
  calendarDayToday: {
    color: theme.colors.accentMid,
    fontWeight: "700",
  },
  eventDot: {
    marginTop: 2,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 6,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  eventDotText: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.primaryDark,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  calendarCell: {
    width: "14.285714%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
    borderColor: theme.colors.border,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.accentMid,
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
    color: theme.colors.primaryMid,
  },
  eventDotSelected: {
    backgroundColor: theme.colors.primaryMid,
  },
  eventDotTextSelected: {
    color: theme.colors.accentMid,
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
  },
  eventModalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: "85%",
    width: "85%",
    maxWidth: 400,
  },
  eventModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
    paddingHorizontal: 20,
  },
  eventModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.accentMid,
    flex: 1,
  },
  eventModalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  eventModalSection: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: 20,
  },
  eventModalLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.accentDark,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  eventModalValue: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: "500",
    lineHeight: 24,
  },
  shareEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 8,
    marginTop: theme.spacing.lg,
    marginHorizontal: 20,
  },
  shareEventButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.primaryDark,
    marginLeft: 8,
  },
  deleteEventButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.danger,
    borderRadius: 8,
    marginTop: theme.spacing.lg,
    marginHorizontal: 20,
  },
  deleteEventButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  
  // Share modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingTop: 24,
    paddingBottom: 32,
    maxHeight: "75%",
    width: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  visibilityOptionSelected: {
    backgroundColor: "rgba(255, 216, 92, 0.1)",
    borderColor: theme.colors.accentMid,
  },
  optionTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "600",
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
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accentMid,
    paddingLeft: 12,
  },
  groupOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  groupOptionSelected: {
    backgroundColor: "rgba(255, 216, 92, 0.15)",
    borderColor: theme.colors.accentMid,
  },
  groupOptionText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.text,
  },
  groupOptionTextSelected: {
    color: theme.colors.accentMid,
    fontWeight: "600",
  },
  noGroupsText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: "italic",
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  cancelButton: {
    backgroundColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
  },
  confirmModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    width: "80%",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
});