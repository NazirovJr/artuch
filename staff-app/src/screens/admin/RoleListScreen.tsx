import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { Card, Text, Badge, List, useTheme } from 'react-native-paper';
import { getRoles } from '../../api/roles';
import { roleColors } from '../../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AdminStackParamList, 'RoleList'>;

export default function RoleListScreen({ navigation }: Props) {
  const theme = useTheme();
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRoles();
      setRoles(data);
    } catch {
      // handle error silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderRole = ({ item }: { item: any }) => {
    const isExpanded = expandedId === item.id;
    const permissions: string[] = item.permissions || [];

    return (
      <Card style={styles.card} onPress={() => toggleExpanded(item.id)}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.roleInfo}>
              <View style={styles.nameRow}>
                <Text variant="titleMedium" style={styles.roleName}>
                  {item.name}
                </Text>
                {item.isSystem && (
                  <Badge style={styles.systemBadge} size={22}>
                    Системная
                  </Badge>
                )}
              </View>
              {item.description && (
                <Text variant="bodySmall" style={styles.description}>
                  {item.description}
                </Text>
              )}
            </View>
            <Text variant="bodySmall" style={{ opacity: 0.4 }}>
              {isExpanded ? '▲' : '▼'}
            </Text>
          </View>

          {isExpanded && permissions.length > 0 && (
            <View style={[styles.permissionsContainer, { borderTopColor: theme.colors.outlineVariant }]}>
              <Text variant="labelSmall" style={styles.permissionsTitle}>
                Разрешения:
              </Text>
              {permissions.map((perm: string, idx: number) => (
                <View key={idx} style={styles.permissionRow}>
                  <Text variant="bodySmall" style={styles.permissionText}>
                    {perm}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {isExpanded && permissions.length === 0 && (
            <View style={[styles.permissionsContainer, { borderTopColor: theme.colors.outlineVariant }]}>
              <Text variant="bodySmall" style={{ opacity: 0.5 }}>
                Нет данных о разрешениях
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={roles}
        keyExtractor={(item) => item.id}
        renderItem={renderRole}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchRoles} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text variant="bodyLarge" style={{ opacity: 0.5 }}>
                Нет ролей
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 80 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleName: { fontWeight: 'bold' },
  systemBadge: {
    backgroundColor: roleColors.manager,
    color: '#fff',
    paddingHorizontal: 6,
    fontSize: 10,
  },
  description: { opacity: 0.6, marginTop: 4 },
  permissionsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  permissionsTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    opacity: 0.7,
  },
  permissionRow: {
    paddingVertical: 2,
    paddingLeft: 8,
  },
  permissionText: {
    opacity: 0.7,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
});
