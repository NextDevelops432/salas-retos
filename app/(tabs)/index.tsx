import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, EmptyState, IconBadge } from '../../components/UI';
import { colors, radius, shadow, spacing } from '../../constants/theme';
import { useIsWideScreen } from '../../lib/useIsWideScreen';
import type { Room } from '../../lib/database.types';

interface RoomListItem extends Room {
  points_balance: number;
  member_count: number;
}

export default function RoomsScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const isWide = useIsWideScreen();
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

  const numColumns = isWide ? 3 : 1;

  return (
    <View style={styles.container}>
      <FlatList
        key={numColumns}
        data={rooms}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? { gap: spacing.md } : undefined}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, rooms.length === 0 && { flex: 1 }]}
        style={{ width: '100%', maxWidth: isWide ? 1100 : 640, alignSelf: 'center' }}
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
        ListHeaderComponent={
          <LinearGradient colors={[colors.bgGradientStart, colors.bgGradientEnd]} style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroGreeting}>¡Hola, {profile?.username?.split('_')[0] ?? ''}! 👋</Text>
              <Text style={styles.heroTitle}>Tus salas</Text>
            </View>
            {isWide && (
              <Button title="+ Nueva sala" variant="secondary" onPress={() => router.push('/room/new')} />
            )}
          </LinearGradient>
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
            <Pressable style={numColumns > 1 ? { flex: 1 } : undefined}>
              <Card style={{ marginBottom: spacing.sm }}>
                <View style={styles.roomRow}>
                  <IconBadge seed={item.id} emoji="🏠" />
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
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

      {!isWide && (
        <Pressable style={styles.fab} onPress={() => router.push('/room/new')}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroGreeting: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 4 },
  roomRow: { flexDirection: 'row', alignItems: 'center' },
  roomName: { color: colors.text, fontSize: 17, fontWeight: '700' },
  roomMeta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  pointsPill: {
    backgroundColor: colors.pointsBg,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pointsText: { color: colors.points, fontWeight: '800', fontSize: 13 },
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
    ...shadow,
  },
  fabText: { color: colors.textOnPrimary, fontSize: 28, fontWeight: '700', marginTop: -2 },
});
