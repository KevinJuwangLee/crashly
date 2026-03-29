import { Pressable, StyleSheet, Text, View } from 'react-native';

const IVORY = '#FAF9F6';
const CHARCOAL = '#2C2C2A';
const MUTED = '#6B6965';
const CARD_BORDER = '#E8E5E0';
const AMBER_BG = '#F4E4BC';
const AMBER_TEXT = '#5C4A1A';
const GREEN_BG = '#D4EDDA';
const GREEN_TEXT = '#1E5B3A';
const RED_BG = '#F8E0E0';
const RED_TEXT = '#8B2E2E';
const GREEN_BTN = '#2F855A';

export type IntroRequestPayload = {
  type?: string;
  via_friend?: string;
  destination_city?: string;
  destination_state?: string;
  date_from?: string;
  date_to?: string;
  requester_name?: string;
  requester_university?: string;
  personal_note?: string;
  connections_count?: number;
  status?: string;
};

function statusPillStyle(status: string | undefined) {
  const s = (status ?? 'pending').toLowerCase();
  if (s === 'accepted') {
    return { bg: GREEN_BG, fg: GREEN_TEXT, label: 'Accepted' };
  }
  if (s === 'declined' || s === 'rejected') {
    return { bg: RED_BG, fg: RED_TEXT, label: 'Declined' };
  }
  return { bg: AMBER_BG, fg: AMBER_TEXT, label: 'Pending' };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function IntroRequestCardView({
  data,
  includePersonalInCard,
  includeRequesterRow = true,
  showConnectorActions,
  onConnect,
  onDecline,
  actionBusy,
}: {
  data: IntroRequestPayload;
  includePersonalInCard: boolean;
  /** Sheet preview omits this row; chat shows requester. */
  includeRequesterRow?: boolean;
  showConnectorActions?: boolean;
  onConnect?: () => void;
  onDecline?: () => void;
  actionBusy?: boolean;
}) {
  const pill = statusPillStyle(data.status);
  const dest = [data.destination_city, data.destination_state]
    .filter(Boolean)
    .join(', ')
    .trim();
  const dates =
    data.date_from?.trim() && data.date_to?.trim()
      ? `${data.date_from.trim()} to ${data.date_to.trim()}`
      : data.date_from?.trim() || data.date_to?.trim() || '—';
  const n =
    typeof data.connections_count === 'number' && !Number.isNaN(data.connections_count)
      ? data.connections_count
      : 0;
  const lookingFor = `A place to stay · ${n} connection${n === 1 ? '' : 's'} found`;
  const requester =
    [data.requester_name, data.requester_university].filter(Boolean).join(' · ') ||
    '—';
  const st = (data.status ?? 'pending').toLowerCase();
  const pending = !['accepted', 'declined', 'rejected'].includes(st);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Introduction Request</Text>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusPillText, { color: pill.fg }]}>
            {pill.label}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <Row label="Requesting" value={data.via_friend?.trim() || '—'} />
      <Row label="Destination" value={dest || '—'} />
      <Row label="Dates" value={dates} />
      <Row label="Looking for" value={lookingFor} />
      {includeRequesterRow ? (
        <Row label="Requester" value={requester} />
      ) : null}
      {includePersonalInCard &&
      data.personal_note != null &&
      data.personal_note.trim() ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Note</Text>
          <Text style={styles.noteText}>{data.personal_note.trim()}</Text>
        </View>
      ) : null}
      {showConnectorActions && pending ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.btnConnect, actionBusy && styles.btnDisabled]}
            onPress={onConnect}
            disabled={actionBusy}
          >
            <Text style={styles.btnConnectLabel}>Connect them</Text>
          </Pressable>
          <Pressable
            style={[styles.btnDecline, actionBusy && styles.btnDisabled]}
            onPress={onDecline}
            disabled={actionBusy}
          >
            <Text style={styles.btnDeclineLabel}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    width: '100%',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 14,
    backgroundColor: IVORY,
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: CHARCOAL,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CARD_BORDER,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '500',
    minWidth: 88,
  },
  rowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: CHARCOAL,
    textAlign: 'right',
    lineHeight: 18,
  },
  noteBlock: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: CHARCOAL,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  btnConnect: {
    flex: 1,
    backgroundColor: GREEN_BTN,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  btnConnectLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IVORY,
  },
  btnDecline: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: CHARCOAL,
    backgroundColor: 'transparent',
  },
  btnDeclineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CHARCOAL,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
