import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import {
  IntroRequestCardView,
  type IntroRequestPayload,
} from '../components/IntroRequestCardView';
import {
  TripRequestCardView,
  type TripRequestPayload,
} from '../components/TripRequestCardView';
import { supabase } from '../lib/supabase';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const WHITE = '#FFFFFF';
const BORDER = 'rgba(44, 44, 42, 0.12)';
const GREEN_PILL = '#2F855A';
const RED_PILL = '#C44B4B';

const CURRENT_USER_ID = 2;
const POLL_MS = 4000;

const BUBBLE_RADIUS = 18;
const BUBBLE_RADIUS_TIGHT = 6;

type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;
type ChatNav = StackNavigationProp<RootStackParamList, 'Chat'>;

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: number | string;
  content: string;
  created_at: string;
  is_trip_request?: boolean | null;
};

function parseJsonMessage(content: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(content) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) {
      return o as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseTripPayload(content: string): TripRequestPayload | null {
  const o = parseJsonMessage(content);
  return o as TripRequestPayload | null;
}

function parseIntroPayload(content: string): IntroRequestPayload | null {
  const o = parseJsonMessage(content);
  return o as IntroRequestPayload | null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const navigation = useNavigation<ChatNav>();
  const { params } = useRoute<ChatRoute>();
  const { conversation_id, other_user_name, trip_summary } = params;

  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [conversationStatus, setConversationStatus] = useState<string | null>(
    null,
  );
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tripExpanded, setTripExpanded] = useState(false);
  const [tripActionBusyId, setTripActionBusyId] = useState<string | null>(null);
  const tripActionBusyRef = useRef(false);

  const destination =
    trip_summary && typeof trip_summary.destination === 'string'
      ? trip_summary.destination.trim()
      : '';
  const tripDates =
    trip_summary && typeof trip_summary.dates === 'string'
      ? trip_summary.dates.trim()
      : '';
  const introSummaryHeader = destination.startsWith('Introduction request');

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true });
    if (error) return;
    setMessages((data as MessageRow[]) ?? []);
  }, [conversation_id]);

  const fetchConversation = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('status')
      .eq('id', conversation_id)
      .maybeSingle();
    if (error || !data) return;
    const s = (data as { status?: string }).status;
    if (typeof s === 'string') setConversationStatus(s);
  }, [conversation_id]);

  useEffect(() => {
    void fetchMessages();
    void fetchConversation();
  }, [fetchMessages, fetchConversation]);

  useEffect(() => {
    const id = setInterval(() => {
      void fetchMessages();
      void fetchConversation();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchMessages, fetchConversation]);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(t);
  }, [messages.length]);

  const firstMessage = messages[0];
  const firstSenderIsOther =
    firstMessage != null &&
    Number(firstMessage.sender_id) !== CURRENT_USER_ID;

  const hasTripRequestInThread = messages.some((m) => Boolean(m.is_trip_request));

  const showAcceptBar =
    conversationStatus === 'pending' &&
    firstSenderIsOther &&
    !hasTripRequestInThread;

  const resolveTripRequest = useCallback(
    async (m: MessageRow, nextStatus: 'accepted' | 'declined') => {
      if (tripActionBusyRef.current) return;
      tripActionBusyRef.current = true;
      setTripActionBusyId(m.id);
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(m.content) as Record<string, unknown>;
      } catch {
        tripActionBusyRef.current = false;
        setTripActionBusyId(null);
        return;
      }
      const nextPayload = { ...parsed, status: nextStatus };
      const [msgRes, convRes] = await Promise.all([
        supabase
          .from('messages')
          .update({ content: JSON.stringify(nextPayload) })
          .eq('id', m.id),
        supabase
          .from('conversations')
          .update({ status: nextStatus })
          .eq('id', conversation_id),
      ]);
      tripActionBusyRef.current = false;
      setTripActionBusyId(null);
      if (!msgRes.error && !convRes.error) {
        void fetchMessages();
        void fetchConversation();
      }
    },
    [conversation_id, fetchMessages, fetchConversation],
  );

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const { error } = await supabase.from('messages').insert({
      conversation_id,
      sender_id: CURRENT_USER_ID,
      content: text,
      created_at: new Date().toISOString(),
    });
    setSending(false);
    if (!error) void fetchMessages();
  }, [input, sending, conversation_id, fetchMessages]);

  const setConversationStatusRemote = useCallback(
    async (status: 'accepted' | 'rejected') => {
      const { error } = await supabase
        .from('conversations')
        .update({ status })
        .eq('id', conversation_id);
      if (!error) {
        setConversationStatus(status);
        void fetchConversation();
      }
    },
    [conversation_id, fetchConversation],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>
            {other_user_name}
          </Text>
          <View style={styles.topBarSpacer} />
        </View>

        {trip_summary && (destination || tripDates) ? (
          <Pressable
            style={styles.tripCard}
            onPress={() => setTripExpanded((e) => !e)}
          >
            {!tripExpanded ? (
              <Text style={styles.tripCardTitle}>
                {introSummaryHeader
                  ? destination
                  : `Trip request · ${destination || tripDates}`}
              </Text>
            ) : (
              <View style={styles.tripCardBody}>
                <Text style={styles.tripCardTitle}>
                  {introSummaryHeader ? 'Introduction request' : 'Trip request'}
                </Text>
                {destination ? (
                  <Text style={styles.tripDetail}>
                    {introSummaryHeader
                      ? destination.replace(/^Introduction request ·\s*/i, '') ||
                        destination
                      : destination}
                  </Text>
                ) : null}
                {tripDates ? (
                  <Text style={styles.tripDetailMuted}>{tripDates}</Text>
                ) : null}
              </View>
            )}
          </Pressable>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => {
            const mine = Number(m.sender_id) === CURRENT_USER_ID;
            if (m.is_trip_request) {
              const raw = parseJsonMessage(m.content);
              const msgType =
                typeof raw?.type === 'string' ? raw.type : '';
              if (msgType === 'intro_request') {
                const introData =
                  parseIntroPayload(m.content) ??
                  ({
                    type: 'intro_request',
                    status: 'pending',
                  } as IntroRequestPayload);
                const showConnectorActions = !mine;
                return (
                  <View key={m.id} style={styles.msgRowCard}>
                    <IntroRequestCardView
                      data={introData}
                      includePersonalInCard
                      includeRequesterRow
                      showConnectorActions={showConnectorActions}
                      onConnect={() => void resolveTripRequest(m, 'accepted')}
                      onDecline={() => void resolveTripRequest(m, 'declined')}
                      actionBusy={tripActionBusyId === m.id}
                    />
                    <Text
                      style={[
                        styles.msgTime,
                        mine ? styles.msgTimeMine : styles.msgTimeTheirs,
                      ]}
                    >
                      {formatTime(m.created_at)}
                    </Text>
                  </View>
                );
              }
              const tripData =
                parseTripPayload(m.content) ??
                ({
                  type: 'trip_request',
                  status: 'pending',
                } as TripRequestPayload);
              const showHostActions = !mine;
              return (
                <View key={m.id} style={styles.msgRowCard}>
                  <TripRequestCardView
                    data={tripData}
                    showPaymentRow={Boolean(tripData.payment_label)}
                    includePersonalInCard
                    showHostActions={showHostActions}
                    onAccept={() => void resolveTripRequest(m, 'accepted')}
                    onDecline={() => void resolveTripRequest(m, 'declined')}
                    actionBusy={tripActionBusyId === m.id}
                  />
                  <Text
                    style={[
                      styles.msgTime,
                      mine ? styles.msgTimeMine : styles.msgTimeTheirs,
                    ]}
                  >
                    {formatTime(m.created_at)}
                  </Text>
                </View>
              );
            }
            return (
              <View
                key={m.id}
                style={[styles.msgRow, mine && styles.msgRowMine]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleTheirs,
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      mine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
                <Text style={styles.msgTime}>{formatTime(m.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>

        {showAcceptBar ? (
          <View style={styles.acceptBar}>
            <Pressable
              style={styles.acceptBtn}
              onPress={() => void setConversationStatusRemote('accepted')}
            >
              <Text style={styles.acceptBtnLabel}>Accept</Text>
            </Pressable>
            <Pressable
              style={styles.declineBtn}
              onPress={() => void setConversationStatusRemote('rejected')}
            >
              <Text style={styles.declineBtnLabel}>Decline</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.bottomBar}>
          <TextInput
            style={styles.inputPill}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={MUTED}
            multiline
            maxLength={4000}
          />
          <Pressable
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            onPress={() => void sendMessage()}
            disabled={sending || !input.trim()}
          >
            <Text style={styles.sendArrow}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: IVORY,
  },
  backBtn: {
    width: 40,
    paddingVertical: 4,
  },
  backArrow: {
    fontSize: 22,
    color: CHARCOAL,
    fontWeight: '500',
  },
  topTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: CHARCOAL,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  topBarSpacer: {
    width: 40,
  },
  tripCard: {
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
  },
  tripCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CHARCOAL,
  },
  tripCardBody: {
    gap: 6,
  },
  tripDetail: {
    fontSize: 15,
    color: CHARCOAL,
    lineHeight: 21,
  },
  tripDetailMuted: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    paddingBottom: 20,
    flexGrow: 1,
  },
  msgRowCard: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    marginBottom: 14,
  },
  msgRow: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    marginBottom: 14,
  },
  msgRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleMine: {
    backgroundColor: CHARCOAL,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_RADIUS_TIGHT,
  },
  bubbleTheirs: {
    backgroundColor: WHITE,
    borderTopLeftRadius: BUBBLE_RADIUS,
    borderTopRightRadius: BUBBLE_RADIUS,
    borderBottomRightRadius: BUBBLE_RADIUS,
    borderBottomLeftRadius: BUBBLE_RADIUS_TIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 22,
  },
  bubbleTextMine: {
    color: IVORY,
  },
  bubbleTextTheirs: {
    color: CHARCOAL,
  },
  msgTime: {
    fontSize: 11,
    color: MUTED,
    marginTop: 4,
    marginHorizontal: 4,
  },
  msgTimeMine: {
    alignSelf: 'flex-end',
  },
  msgTimeTheirs: {
    alignSelf: 'flex-start',
  },
  acceptBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: IVORY,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: GREEN_PILL,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  acceptBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IVORY,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: RED_PILL,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  declineBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: IVORY,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: IVORY,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: WHITE,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
    color: CHARCOAL,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendArrow: {
    fontSize: 20,
    color: IVORY,
    fontWeight: '600',
    marginLeft: 2,
  },
});
