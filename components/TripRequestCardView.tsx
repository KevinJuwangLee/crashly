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

export type TripRequestPayload = {
  type?: string;
  destination_city?: string;
  destination_state?: string;
  date_from?: string;
  date_to?: string;
  guest_name?: string;
  guest_university?: string;
  personal_note?: string;
  status?: string;
  payment_label?: string;
};

export function HouseIcon() {
  return (
    <View style={houseStyles.wrap}>
      <View style={houseStyles.roof} />
      <View style={houseStyles.body} />
    </View>
  );
}

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

function TripRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function TripRequestCardView({
  data,
  showPaymentRow,
  includePersonalInCard,
  showHostActions,
  onAccept,
  onDecline,
  actionBusy,
}: {
  data: TripRequestPayload;
  showPaymentRow: boolean;
  includePersonalInCard: boolean;
  showHostActions?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  actionBusy?: boolean;
}) {
  const pill = statusPillStyle(data.status);
  const dest = [data.destination_city, data.destination_state]
    .filter(Boolean)
    .join(', ')
    .trim();

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <HouseIcon />
        <Text style={styles.headerTitle}>Stay Request</Text>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusPillText, { color: pill.fg }]}>
            {pill.label}
          </Text>
        </View>
      </View>
      <View style={styles.divider} />
      <TripRow label="From" value={data.date_from?.trim() || '—'} />
      <TripRow label="To" value={data.date_to?.trim() || '—'} />
      <TripRow label="Destination" value={dest || '—'} />
      <TripRow
        label="Guest"
        value={
          [data.guest_name, data.guest_university].filter(Boolean).join(' · ') ||
          '—'
        }
      />
      {showPaymentRow && data.payment_label ? (
        <TripRow label="Payment" value={data.payment_label} />
      ) : null}
      {includePersonalInCard &&
      data.personal_note != null &&
      data.personal_note.trim() ? (
        <View style={styles.noteBlock}>
          <Text style={styles.noteLabel}>Note</Text>
          <Text style={styles.noteText}>{data.personal_note.trim()}</Text>
        </View>
      ) : null}
      {showHostActions &&
      !['accepted', 'declined', 'rejected'].includes(
        (data.status ?? 'pending').toLowerCase(),
      ) ? (
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actAccept, actionBusy && styles.actDisabled]}
            onPress={onAccept}
            disabled={actionBusy}
          >
            <Text style={styles.actAcceptLabel}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.actDecline, actionBusy && styles.actDisabled]}
            onPress={onDecline}
            disabled={actionBusy}
          >
            <Text style={styles.actDeclineLabel}>Decline</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const houseStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 22,
    width: 22,
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: CHARCOAL,
    marginBottom: -1,
  },
  body: {
    width: 14,
    height: 9,
    backgroundColor: CHARCOAL,
    borderRadius: 1,
  },
});

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
  actAccept: {
    flex: 1,
    backgroundColor: GREEN_TEXT,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  actAcceptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IVORY,
  },
  actDecline: {
    flex: 1,
    backgroundColor: RED_TEXT,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  actDeclineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: IVORY,
  },
  actDisabled: {
    opacity: 0.45,
  },
});
