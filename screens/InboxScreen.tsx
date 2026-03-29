import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RootStackParamList } from '../App';
import { supabase } from '../lib/supabase';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const CARD_BORDER = '#E8E5E0';
const IVORY_TEXT = '#FAF9F6';
const STATUS_ACCEPTED_BG = '#D4EDDA';
const STATUS_ACCEPTED_TEXT = '#1E5B3A';
const STATUS_PENDING_BG = '#F4E4BC';
const STATUS_PENDING_TEXT = '#5C4A1A';
const STATUS_DECLINED_BG = '#F8E0E0';
const STATUS_DECLINED_TEXT = '#8B2E2E';

const CURRENT_USER_ID = 2;

type InboxNav = StackNavigationProp<RootStackParamList, 'Inbox'>;

type ConversationRow = {
  id: string;
  user_id_1: number | string;
  user_id_2: number | string;
  status: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  name: string | null;
};

type InboxCombinedRow = {
  conversation: ConversationRow;
  otherProfile: ProfileRow | null;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const a = parts[0]![0] ?? '';
  const b = parts[parts.length - 1]![0] ?? '';
  return (a + b).toUpperCase();
}

function formatListTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function statusPillMeta(
  status: string | null | undefined,
): { label: string; bg: string; fg: string } {
  const s = (status ?? '').toLowerCase();
  if (s === 'accepted') {
    return {
      label: 'Accepted',
      bg: STATUS_ACCEPTED_BG,
      fg: STATUS_ACCEPTED_TEXT,
    };
  }
  if (s === 'rejected' || s === 'declined') {
    return {
      label: 'Declined',
      bg: STATUS_DECLINED_BG,
      fg: STATUS_DECLINED_TEXT,
    };
  }
  return {
    label: 'Pending',
    bg: STATUS_PENDING_BG,
    fg: STATUS_PENDING_TEXT,
  };
}

export default function InboxScreen() {
  const navigation = useNavigation<InboxNav>();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InboxCombinedRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: convData, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .or(
        `user_id_1.eq.${CURRENT_USER_ID},user_id_2.eq.${CURRENT_USER_ID}`,
      )
      .order('created_at', { ascending: false });

    if (convError) {
      console.log('Conversations error:', JSON.stringify(convError));
    }
    console.log('Conversations raw:', JSON.stringify(convData));

    if (convError || !convData?.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const conversations = convData as ConversationRow[];

    const combined: InboxCombinedRow[] = await Promise.all(
      conversations.map(async (conv) => {
        const otherId =
          Number(conv.user_id_1) === CURRENT_USER_ID
            ? String(conv.user_id_2)
            : String(conv.user_id_1);

        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('id', otherId)
          .maybeSingle();

        return {
          conversation: conv,
          otherProfile: (otherProfile as ProfileRow | null) ?? null,
        };
      }),
    );

    console.log('Inbox final combined:', JSON.stringify(combined));

    setRows(combined);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Text style={styles.title}>Messages</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={MUTED} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>No messages yet</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {rows.map(({ conversation, otherProfile }) => {
              const otherName =
                (otherProfile?.name ?? '').trim() || 'User';
              const otherInitials = initialsFromName(otherName);
              const pill = statusPillMeta(conversation.status);
              return (
                <Pressable
                  key={conversation.id}
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('Chat', {
                      conversation_id: String(conversation.id),
                      other_user_name: otherName,
                      other_user_initials: otherInitials,
                    })
                  }
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{otherInitials}</Text>
                  </View>
                  <View style={styles.center}>
                    <Text style={styles.name} numberOfLines={1}>
                      {otherName}
                    </Text>
                  </View>
                  <View style={styles.rightCol}>
                    <Text style={styles.time}>
                      {formatListTimestamp(conversation.created_at)}
                    </Text>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]}>
                        {pill.label}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IVORY,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: CHARCOAL,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    letterSpacing: -0.4,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: MUTED,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: IVORY,
    gap: 12,
  },
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: IVORY_TEXT,
    letterSpacing: 0.3,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: CHARCOAL,
    letterSpacing: -0.2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    minHeight: 45,
    paddingLeft: 4,
  },
  time: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '500',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
