// core/hooks/useEvents.js
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import { useAllUserGroups } from "@core/groups/hooks";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

export function useEvents(filters = {}) {
  const { user, profile } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { groups: userGroups } = useAllUserGroups(user?.uid);
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchEvents() {
      try {
        setLoading(true);
        const eventsRef = collection(db, "events");

        // Fetch ALL events (we'll filter client-side for visibility)
        let q = query(eventsRef);

        // Apply region filters if needed (these are safe to apply at query level)
        if (filters.regions && Array.isArray(filters.regions) && filters.regions.length > 0) {
          q = query(eventsRef, where("region", "in", filters.regions));
        } else if (filters.region && filters.region !== "") {
          q = query(eventsRef, where("region", "==", filters.region));
        }

        const snapshot = await getDocs(q);
        let eventsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Get user group IDs
        const userGroupIds = (userGroups || []).map(g => g.id);

        // Admins can see all events
        if (profile?.role === 'admin') {
          // No filtering for admin
        } else {
          // Filter client-side for visibility and ownership
          eventsList = eventsList.filter((event) => {
            // Always include events created by current user
            if (event.userId === user.uid || event.createdBy === user.uid) {
              return true;
            }
            // Include public events
            if (event.visibility === "public") {
              return true;
            }
            // Include private events (if user is creator)
            if (event.visibility === "private" && (event.userId === user.uid || event.createdBy === user.uid)) {
              return true;
            }
            // Include group events if user is in the group
            if (event.visibility === "group" && Array.isArray(event.groupIds) && event.groupIds.some(gid => userGroupIds.includes(gid))) {
              return true;
            }
            return false;
          });
        }

        // Apply other filters
        if (filters.placeId) {
          eventsList = eventsList.filter(e => e.placeId === filters.placeId);
        }

        if (filters.createdBy) {
          eventsList = eventsList.filter(e => e.createdBy === filters.createdBy || e.userId === filters.createdBy);
        }

        if (filters.suitability && Array.isArray(filters.suitability) && filters.suitability.length > 0) {
          eventsList = eventsList.filter((event) => {
            if (!event.suitability || event.suitability.length === 0) return true;
            return filters.suitability.some((suit) => event.suitability.includes(suit));
          });
        }

        setEvents(eventsList);
        setError(null);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [user, filters, userGroups]);

  const createEvent = async (eventData) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const eventsRef = collection(db, "events");
      const docRef = await addDoc(eventsRef, {
        ...eventData,
        userId: user.uid,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        attendees: [user.uid],
      });
      return docRef.id;
    } catch (err) {
      console.error("Error creating event:", err);
      throw err;
    }
  };

  const updateEvent = async (eventId, eventData) => {
    try {
      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, {
        ...eventData,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error updating event:", err);
      throw err;
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      const eventRef = doc(db, "events", eventId);
      await deleteDoc(eventRef);
    } catch (err) {
      console.error("Error deleting event:", err);
      throw err;
    }
  };

  const deleteEventSeries = async (seriesId) => {
    try {
      // Delete all events with this seriesId
      const eventsRef = collection(db, "events");
      const q = query(eventsRef, where("seriesId", "==", seriesId));
      const snapshot = await getDocs(q);
      
      // Delete all matching documents
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (err) {
      console.error("Error deleting event series:", err);
      throw err;
    }
  };

  const joinEvent = async (eventId) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDocs(query(collection(db, "events"), where("__name__", "==", eventId)));
      
      if (eventSnap.docs.length > 0) {
        const eventData = eventSnap.docs[0].data();
        const attendees = eventData.attendees || [];
        
        if (!attendees.includes(user.uid)) {
          attendees.push(user.uid);
          await updateDoc(eventRef, { attendees });
        }
      }
    } catch (err) {
      console.error("Error joining event:", err);
      throw err;
    }
  };

  const leaveEvent = async (eventId) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDocs(query(collection(db, "events"), where("__name__", "==", eventId)));
      
      if (eventSnap.docs.length > 0) {
        const eventData = eventSnap.docs[0].data();
        const attendees = (eventData.attendees || []).filter((id) => id !== user.uid);
        await updateDoc(eventRef, { attendees });
      }
    } catch (err) {
      console.error("Error leaving event:", err);
      throw err;
    }
  };

  return {
    events,
    loading,
    error,
    createEvent,
    updateEvent,
    deleteEvent,
    deleteEventSeries,
    joinEvent,
    leaveEvent,
  };
}
