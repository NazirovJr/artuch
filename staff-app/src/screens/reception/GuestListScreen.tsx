import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Card, Text, TextInput, FAB, useTheme } from 'react-native-paper';
import { useRoomStore } from '../../store/roomStore';
import { getGuests } from '../../api/guests';

interface Props {
  onCreateGuest: () => void;
  onBack: () => void;
}

export default function GuestListScreen({ onCreateGuest, onBack }: Props) {
  const theme = useTheme();
  const { guests, loading, setGuests, setLoading } = useRoomStore();
  const [search, setSearch] = useState('');

  const loadGuests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGuests();
      setGuests(data);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [setGuests, setLoading]);

  useEffect(() => {
    loadGuests();
  }, [loadGuests]);

  const filteredGuests = search
    ? guests.filter(
        (g: any) =>
          `${g.firstName} ${g.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
          g.phone?.toLowerCase().includes(search.toLowerCase()) ||
          g.email?.toLowerCase().includes(search.toLowerCase()) ||
          g.passportNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : guests;

  const renderGuest = ({ item }: { item: any }) => (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">
          {item.firstName} {item.lastName}
        </Text>
        {item.nationality ? (
          <Text variant="bodySmall" style={styles.secondary}>
            {item.nationality}
          </Text>
        ) : null}
        {item.passportNumber ? (
          <Text variant="bodySmall" style={styles.secondary}>
            Паспорт: {item.passportNumber}
          </Text>
        ) : null}
        {item.phone ? (
          <Text variant="bodySmall" style={styles.secondary}>
            Тел: {item.phone}
          </Text>
        ) : null}
        {item.email ? (
          <Text variant="bodySmall" style={styles.secondary}>
            Email: {item.email}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineMedium" style={styles.title}>
        Гости
      </Text>

      <TextInput
        placeholder="Поиск по имени, телефону, паспорту..."
        value={search}
        onChangeText={setSearch}
        mode="outlined"
        style={styles.searchInput}
        left={<TextInput.Icon icon="magnify" />}
        dense
      />

      <FlatList
        data={filteredGuests}
        renderItem={renderGuest}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadGuests} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>Гости не найдены</Text>
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={onCreateGuest}
        color="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { padding: 16, paddingBottom: 8, fontWeight: 'bold' },
  searchInput: { marginHorizontal: 16, marginBottom: 8 },
  list: { padding: 8 },
  card: { marginHorizontal: 8, marginVertical: 4 },
  secondary: { opacity: 0.6, marginTop: 2 },
  emptyText: { textAlign: 'center', marginTop: 32, opacity: 0.5 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
