import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow, spacing } from '../constants/theme';

interface NotificationItem {
  id: string;
  roomId: string;
  title: string;
  meta: string;
}

export function NotificationsBell() {
  const { session } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: memberships } = await supabase.from('room_members').select('room_id').eq('user_id', session.user.id);
    const roomIds = Array.from(new Set((memberships ?? []).map((m: any) => m.room_id)));
    if (roomIds.length === 0) {
      setItems([]);
      return;
    }

    const [{ data: completions }, { data: redemptions }, { data: taskProposals }, { data: rewardProposals }] =
      await Promise.all([
        supabase
          .from('task_completions')
          .select('id, task_id, room_id')
          .in('room_id', roomIds)
          .eq('status', 'pending')
          .neq('user_id', session.user.id),
        supabase
          .from('reward_redemptions')
          .select('id, reward_id, room_id')
          .in('room_id', roomIds)
          .eq('status', 'pending')
          .neq('user_id', session.user.id),
        supabase
          .from('tasks')
          .select('id, room_id, title')
          .in('room_id', roomIds)
          .eq('approval_status', 'pending')
          .eq('assigned_to', session.user.id),
        supabase
          .from('rewards')
          .select('id, room_id, title')
          .in('room_id', roomIds)
          .eq('approval_status', 'pending')
          .neq('last_modified_by', session.user.id),
      ]);

    const taskIds = Array.from(new Set((completions ?? []).map((c: any) => c.task_id)));
    const rewardIds = Array.from(new Set((redemptions ?? []).map((r: any) => r.reward_id)));
    const roomIdsNeeded = Array.from(
      new Set([
        ...(completions ?? []).map((c: any) => c.room_id),
        ...(redemptions ?? []).map((r: any) => r.room_id),
        ...(taskProposals ?? []).map((t: any) => t.room_id),
        ...(rewardProposals ?? []).map((r: any) => r.room_id),
      ])
    );

    const [{ data: tasks }, { data: rewards }, { data: rooms }] = await Promise.all([
      taskIds.length ? supabase.from('tasks').select('id, title').in('id', taskIds) : Promise.resolve({ data: [] as any[] }),
      rewardIds.length
        ? supabase.from('rewards').select('id, title').in('id', rewardIds)
        : Promise.resolve({ data: [] as any[] }),
      roomIdsNeeded.length
        ? supabase.from('rooms').select('id, name').in('id', roomIdsNeeded)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const taskById = new Map((tasks ?? []).map((t: any) => [t.id, t.title]));
    const rewardById = new Map((rewards ?? []).map((r: any) => [r.id, r.title]));
    const roomById = new Map((rooms ?? []).map((r: any) => [r.id, r.name]));

    const all: NotificationItem[] = [
      ...(completions ?? []).map((c: any) => ({
        id: `tc-${c.id}`,
        roomId: c.room_id,
        title: `Evidencia: ${taskById.get(c.task_id) ?? 'Reto'}`,
        meta: roomById.get(c.room_id) ?? 'Sala',
      })),
      ...(redemptions ?? []).map((r: any) => ({
        id: `rr-${r.id}`,
        roomId: r.room_id,
        title: `Canje: ${rewardById.get(r.reward_id) ?? 'Recompensa'}`,
        meta: roomById.get(r.room_id) ?? 'Sala',
      })),
      ...(taskProposals ?? []).map((t: any) => ({
        id: `tp-${t.id}`,
        roomId: t.room_id,
        title: `Reto propuesto: ${t.title}`,
        meta: roomById.get(t.room_id) ?? 'Sala',
      })),
      ...(rewardProposals ?? []).map((r: any) => ({
        id: `rp-${r.id}`,
        roomId: r.room_id,
        title: `Recompensa propuesta: ${r.title}`,
        meta: roomById.get(r.room_id) ?? 'Sala',
      })),
    ];

    setItems(all);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goTo = (item: NotificationItem) => {
    setOpen(false);
    router.push({ pathname: '/room/[id]/review', params: { id: item.roomId } });
  };

  return (
    <View>
      <Pressable style={styles.bellBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={{ fontSize: 18 }}>🔔</Text>
        {items.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{items.length > 9 ? '9+' : items.length}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.panelWrap}>
            <Pressable style={styles.panel} onPress={() => {}}>
              <Text style={styles.panelTitle}>Pendientes</Text>
              {items.length === 0 ? (
                <Text style={styles.emptyText}>No tienes nada pendiente por revisar.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 320 }}>
                  {items.map((item) => (
                    <Pressable key={item.id} style={styles.item} onPress={() => goTo(item)}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.itemMeta}>{item.meta}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 26, 61, 0.25)',
  },
  panelWrap: {
    position: 'absolute',
    top: 64,
    right: spacing.md,
    alignItems: 'flex-end',
  },
  panel: {
    width: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    ...shadow,
  },
  panelTitle: { color: colors.text, fontWeight: '800', fontSize: 13, padding: spacing.xs },
  emptyText: { color: colors.textMuted, fontSize: 13, padding: spacing.sm },
  item: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  itemTitle: { color: colors.text, fontWeight: '700', fontSize: 13 },
  itemMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
