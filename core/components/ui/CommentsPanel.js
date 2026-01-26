// core/components/ui/CommentsPanel.js
import { AuthContext } from "@context/AuthContext";
import { useComments } from "@core/hooks/useComments";
import { Ionicons } from "@expo/vector-icons";
import theme from "@themes";
import { useContext, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export function CommentsPanel({ placeId, placeName }) {
  const { user } = useContext(AuthContext);
  const { comments, loading, addComment, addReply, deleteComment, deleteReply } =
    useComments(placeId);

  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      Alert.alert("Empty comment", "Please write something");
      return;
    }

    setSubmitting(true);
    try {
      await addComment(newComment);
      setNewComment("");
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReply = async (commentId) => {
    if (!replyText.trim()) {
      Alert.alert("Empty reply", "Please write something");
      return;
    }

    setSubmitting(true);
    try {
      await addReply(commentId, replyText);
      setReplyText("");
      setReplyingTo(null);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId) => {
    Alert.alert("Delete comment?", "This cannot be undone", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(commentId);
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  const handleDeleteReply = (commentId, replyId) => {
    Alert.alert("Delete reply?", "This cannot be undone", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReply(commentId, replyId);
          } catch (err) {
            Alert.alert("Error", err.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={theme.colors.accentMid} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Comments ({comments.length})</Text>

      {/* Comment Input */}
      <View style={styles.inputSection}>
        <TextInput
          value={newComment}
          onChangeText={setNewComment}
          placeholder="Add a comment..."
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          multiline
          maxHeight={80}
        />
        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          disabled={submitting}
          onPress={handleAddComment}
        >
          <Ionicons
            name="send"
            size={18}
            color={theme.colors.primaryDark}
          />
        </TouchableOpacity>
      </View>

      {/* Comments List */}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        renderItem={({ item: comment }) => (
          <View key={comment.id} style={styles.commentItem}>
            {/* Comment Header */}
            <View style={styles.commentHeader}>
              <View style={styles.authorSection}>
                <Text style={styles.authorName}>
                  {comment.createdByName}
                </Text>
                <Text style={styles.timestamp}>
                  {new Date(comment.createdAt?.toDate?.()).toLocaleDateString()}
                </Text>
              </View>
              {user?.uid === comment.createdBy && (
                <TouchableOpacity
                  onPress={() => handleDeleteComment(comment.id)}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={theme.colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Comment Text */}
            <Text style={styles.commentText}>{comment.text}</Text>

            {/* Reply Button */}
            <TouchableOpacity
              style={styles.replyButton}
              onPress={() =>
                setReplyingTo(
                  replyingTo === comment.id ? null : comment.id
                )
              }
            >
              <Ionicons
                name="arrow-redo"
                size={14}
                color={theme.colors.accentMid}
              />
              <Text style={styles.replyButtonText}>Reply</Text>
            </TouchableOpacity>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
              <View style={styles.repliesContainer}>
                {comment.replies.map((reply) => (
                  <View key={reply.id} style={styles.replyItem}>
                    <View style={styles.replyHeader}>
                      <Text style={styles.replyAuthor}>
                        {reply.createdByName}
                      </Text>
                      {user?.uid === reply.createdBy && (
                        <TouchableOpacity
                          onPress={() =>
                            handleDeleteReply(comment.id, reply.id)
                          }
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color={theme.colors.textMuted}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.replyText}>{reply.text}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Reply Input */}
            {replyingTo === comment.id && (
              <View style={styles.replyInputSection}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Write a reply..."
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.replyInput}
                  multiline
                  maxHeight={60}
                />
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    submitting && { opacity: 0.7 },
                  ]}
                  disabled={submitting}
                  onPress={() => handleAddReply(comment.id)}
                >
                  <Ionicons
                    name="send"
                    size={16}
                    color={theme.colors.primaryDark}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {comments.length === 0 && (
        <Text style={styles.emptyText}>
          No comments yet. Be the first to share your thoughts!
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  inputSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: theme.colors.inputText,
    maxHeight: 80,
  },
  submitButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.accentMid,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  commentItem: {
    marginBottom: theme.spacing.md,
    padding: 12,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accentMid,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  authorSection: {
    flex: 1,
  },
  authorName: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
  },
  timestamp: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  commentText: {
    fontSize: 12,
    color: theme.colors.text,
    marginBottom: 8,
    lineHeight: 16,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.accentMid,
  },
  repliesContainer: {
    marginTop: 10,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  replyItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  replyAuthor: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.text,
  },
  replyText: {
    fontSize: 11,
    color: theme.colors.text,
    lineHeight: 14,
  },
  replyInputSection: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  replyInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.inputBorder,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
    color: theme.colors.inputText,
    maxHeight: 60,
  },
  emptyText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginVertical: theme.spacing.lg,
  },
});
