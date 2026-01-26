// core/hooks/useEvents.js
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
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
  const { user } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchEvents() {
      try {
        setLoading(true);
        const eventsRef = collection(db, "events");
        let q = query(eventsRef);

        // Apply filters
        const constraints = [];

        // Always filter by current user's events
        constraints.push(where("userId", "==", user.uid));

        if (filters.placeId) {
          constraints.push(where("placeId", "==", filters.placeId));
        }

        if (filters.createdBy) {
          constraints.push(where("createdBy", "==", filters.createdBy));
        }

        if (filters.region && filters.region !== "") {
          constraints.push(where("region", "==", filters.region));
        }

        // Handle regions array (for multi-select filtering)
        if (filters.regions && Array.isArray(filters.regions) && filters.regions.length > 0) {
          constraints.push(where("region", "in", filters.regions));
        }

        if (constraints.length > 0) {
          q = query(eventsRef, ...constraints);
        }

        const snapshot = await getDocs(q);
        const eventsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

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
  }, [user, filters]);

  const createEvent = async (eventData) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const eventsRef = collection(db, "events");
      const docRef = await addDoc(eventsRef, {
        ...eventData,
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
