import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Card, EmptyState } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';
import type { Room } from '../../lib/database.types';

interface RoomListItem extends Room {
  points_balance: number;
  member_count: number;
}

export default function RoomsScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room:rooms(*)')
      .eq('user_id', session.user.id);

    const roomsData = (memberships ?? [])
      .map((m: any) => m.room)
      .filter(Boolean) as Room[];

    if (roomsData.length === 0) {
      setRooms([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const roomIds = roomsData.map((r) => r.id);

    const [{ data: points }, { data: members }] = await Promise.all([
      supabase
        .from('room_member_points')
        .select('room_id, points_balance')
        .eq('user_id', session.user.id)
        .in('room_id', roomIds),
      supabase.from('room_members').select('room_id').in('room_id', roomIds),
    ]);

    const pointsByRoom = new Map<string, number>((points ?? []).map((p: any) => [p.room_id, p.points_balance]));
    const countByRoom = new Map<string, number>();
    for (const m of members ?? []) {
      countByRoom.set(m.room_id, (countByRoom.get(m.room_id) ?? 0) + 1);
    }

    setRooms(
      roomsData
        .map((r) => ({
          ...r,
          points_balance: pointsByRoom.get(r.id) ?? 0,
          member_count: countByRoom.get(r.id) ?? 1,
        }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    );
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rooms.length === 0 ? { flex: 1 } : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Aún no estás en ninguna sala"
              subtitle="Crea una sala o únete con un código de invitación."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/room/[id]', params: { id: item.id } }} asChild>
            <Pressable>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.roomRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomName}>{item.name}</Text>
                    <Text style={styles.roomMeta}>
                      {item.member_count} {item.member_count === 1 ? 'miembro' : 'miembros'} · código{' '}
                      {item.invite_code}
                    </Text>
                  </View>
                  <View style={styles.pointsPill}>
                    <Text style={styles.pointsText}>{item.points_balance} pts</Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          </Link>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/room/new')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md },
  roomRow: { flexDirection: 'row', alignItems: 'center' },
  roomName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  roomMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  pointsPill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pointsText: { color: colors.points, fontWeight: '700', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: -2 },
});
