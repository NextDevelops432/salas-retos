import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Button, DashboardHeader, EmptyState, StreakCard, Tile } from '../../components/UI';
import { colors, radius, spacing } from '../../constants/theme';
import { useIsWideScreen } from '../../lib/useIsWideScreen';
import { computeLevel, computeStreak } from '../../lib/gamification';
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
  const [lifetimePoints, setLifetimePoints] = useState(0);
  const [streak, setStreak] = useState(computeStreak([]));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;

    const { data: approvedDates } = await supabase
      .from('task_completions')
      .select('reviewed_at, completed_at')
      .eq('user_id', session.user.id)
      .eq('status', 'approved');
    setStreak(computeStreak((approvedDates ?? []).map((r: any) => r.reviewed_at ?? r.completed_at)));

    const { data: memberships } = await supabase
      .from('room_members')
      .select('room:rooms(*)')
      .eq('user_id', session.user.id);

    const roomsData = (memberships ?? [])
      .map((m: any) => m.room)
      .filter(Boolean) as Room[];

    if (roomsData.length === 0) {
      setRooms([]);
      setLifetimePoints(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const roomIds = roomsData.map((r) => r.id);

    const [{ data: points }, { data: members }] = await Promise.all([
      supabase
        .from('room_member_points')
        .select('room_id, points_balance, points_earned')
        .eq('user_id', session.user.id)
        .in('room_id', roomIds),
      supabase.from('room_members').select('room_id').in('room_id', roomIds),
    ]);

    const pointsByRoom = new Map<string, number>((points ?? []).map((p: any) => [p.room_id, p.points_balance]));
    const countByRoom = new Map<string, number>();
    for (const m of members ?? []) {
      countByRoom.set(m.room_id, (countByRoom.get(m.room_id) ?? 0) + 1);
    }

    setLifetimePoints((points ?? []).reduce((sum: number, p: any) => sum + (p.points_earned ?? 0), 0));

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

  const numColumns = isWide ? 4 : 2;
  const totalPoints = rooms.reduce((sum, r) => sum + r.points_balance, 0);
  const level = computeLevel(lifetimePoints);

  return (
    <View style={styles.container}>
      <FlatList
        key={numColumns}
        data={rooms}
        numColumns={numColumns}
        columnWrapperStyle={{ gap: spacing.md }}
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
          <View>
            <DashboardHeader
              greeting={`¡Hola, ${profile?.username?.split('_')[0] ?? ''}! 👋`}
              subtitle="Estas son tus salas"
              username={profile?.username}
            />

            <View style={isWide ? styles.statsRowWide : undefined}>
              <LinearGradient
                colors={[colors.bgGradientStart, colors.bgGradientEnd]}
                style={[styles.hero, isWide && { flex: 2 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>Puntos totales · Nivel {level.level}</Text>
                  <Text style={styles.heroValue}>⭐ {totalPoints}</Text>
                  <Text style={styles.heroHint}>
                    En {rooms.length} {rooms.length === 1 ? 'sala' : 'salas'} · Faltan{' '}
                    {level.pointsForNextLevel - level.pointsIntoLevel} pts para el nivel {level.level + 1}
                  </Text>
                </View>
                <Button title="+ Nueva sala" variant="secondary" onPress={() => router.push('/room/new')} />
              </LinearGradient>

              {isWide ? (
                <>
                  <View style={{ width: spacing.md }} />
                  <View style={{ flex: 1 }}>
                    <StreakCard current={streak.current} weekMarks={streak.weekMarks} />
                  </View>
                </>
              ) : null}
            </View>

            {!isWide ? (
              <>
                <View style={{ height: spacing.md }} />
                <StreakCard current={streak.current} weekMarks={streak.weekMarks} />
              </>
            ) : null}

            <View style={{ height: spacing.lg }} />
            <Text style={styles.sectionTitle}>Tus salas</Text>
            <View style={{ height: spacing.sm }} />
          </View>
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
          <View style={{ flex: 1 }}>
            <Tile
              seed={item.id}
              emoji="🏠"
              title={item.name}
              meta={`${item.member_count} ${item.member_count === 1 ? 'miembro' : 'miembros'} · ${item.invite_code}`}
              points={item.points_balance}
              onPress={() => router.push({ pathname: '/room/[id]', params: { id: item.id } })}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.md, gap: spacing.md },
  statsRowWide: { flexDirection: 'row', alignItems: 'stretch' },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  heroHint: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
