import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { generateOnline } from '../src/api/client';
import { generateOffline } from '../src/services/localInference';

type Message = { role: 'user' | 'assistant'; content: string };

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'OWN AI Mobile — toggle offline mode for on-device QVAC inference.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const output = offlineMode
        ? await generateOffline(userText, { max_tokens: 150 })
        : await generateOnline(userText, { max_tokens: 150 });

      setMessages((prev) => [...prev, { role: 'assistant', content: output }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modeBar}>
        <Text style={styles.modeLabel}>Offline Mode</Text>
        <Switch
          value={offlineMode}
          onValueChange={setOfflineMode}
          trackColor={{ false: '#334155', true: '#0288d1' }}
        />
        <Text style={styles.modeHint}>
          {offlineMode ? 'On-device QVAC' : 'Cloud API'}
        </Text>
      </View>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={styles.bubbleRole}>{msg.role === 'user' ? 'You' : 'AI'}</Text>
            <Text style={styles.bubbleText}>{msg.content}</Text>
          </View>
        ))}
        {loading && <ActivityIndicator color="#0288d1" style={{ marginTop: 12 }} />}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#64748b"
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  modeLabel: { color: '#f8fafc', fontWeight: '600' },
  modeHint: { color: '#64748b', fontSize: 12, marginLeft: 'auto' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  bubble: { borderRadius: 16, padding: 12, maxWidth: '85%' },
  userBubble: { backgroundColor: '#0288d1', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: {
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bubbleRole: { fontSize: 11, color: '#94a3b8', marginBottom: 4 },
  bubbleText: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 15,
  },
  sendBtn: {
    backgroundColor: '#0288d1',
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '600' },
});
