// core/hooks/useComments.js
import { db } from "@config/firebase";
import { AuthContext } from "@context/AuthContext";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import { useContext, useEffect, useState } from "react";

export function useComments(placeId) {
  const { user } = useContext(AuthContext);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!placeId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const commentsRef = collection(db, "places", placeId, "comments");
    const q = query(commentsRef, orderBy("createdAt", "desc"));

    // Real-time listener
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const commentsList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Fetch replies for each comment
          const commentsWithReplies = await Promise.all(
            commentsList.map(async (comment) => {
              const repliesRef = collection(
                db,
                "places",
                placeId,
                "comments",
                comment.id,
                "replies"
              );
              const repliesSnapshot = await getDocs(repliesRef);
              const replies = repliesSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }));
              return {
                ...comment,
                replies: replies,
              };
            })
          );

          setComments(commentsWithReplies);
          setError(null);
        } catch (err) {
          console.error("Error fetching comments:", err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error listening to comments:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [placeId]);

  const addComment = async (text) => {
    if (!user || !placeId) throw new Error("User or place not found");

    try {
      const commentsRef = collection(db, "places", placeId, "comments");
      const docRef = await addDoc(commentsRef, {
        text: text.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        likes: 0,
      });
      return docRef.id;
    } catch (err) {
      console.error("Error adding comment:", err);
      throw err;
    }
  };

  const addReply = async (commentId, text) => {
    if (!user || !placeId) throw new Error("User or place not found");

    try {
      const repliesRef = collection(
        db,
        "places",
        placeId,
        "comments",
        commentId,
        "replies"
      );
      const docRef = await addDoc(repliesRef, {
        text: text.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || "Anonymous",
        createdAt: serverTimestamp(),
        likes: 0,
      });
      return docRef.id;
    } catch (err) {
      console.error("Error adding reply:", err);
      throw err;
    }
  };

  const deleteComment = async (commentId) => {
    if (!placeId) throw new Error("Place not found");

    try {
      const commentRef = doc(db, "places", placeId, "comments", commentId);
      await deleteDoc(commentRef);
    } catch (err) {
      console.error("Error deleting comment:", err);
      throw err;
    }
  };

  const deleteReply = async (commentId, replyId) => {
    if (!placeId) throw new Error("Place not found");

    try {
      const replyRef = doc(
        db,
        "places",
        placeId,
        "comments",
        commentId,
        "replies",
        replyId
      );
      await deleteDoc(replyRef);
    } catch (err) {
      console.error("Error deleting reply:", err);
      throw err;
    }
  };

  const updateComment = async (commentId, text) => {
    if (!placeId) throw new Error("Place not found");

    try {
      const commentRef = doc(db, "places", placeId, "comments", commentId);
      await updateDoc(commentRef, {
        text: text.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error updating comment:", err);
      throw err;
    }
  };

  return {
    comments,
    loading,
    error,
    addComment,
    addReply,
    deleteComment,
    deleteReply,
    updateComment,
  };
}
