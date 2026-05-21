import React, { useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card, Chip, IconButton, Text, useTheme } from 'react-native-paper';
import type { RoomType } from '../api/room-types';

interface Props {
  roomType: RoomType;
  /** Hide the photo strip if there's only the cover (e.g. compact contexts). */
  compact?: boolean;
}

const AMENITY_LABELS: Record<string, { label: string; icon: string }> = {
  wifi: { label: 'Wi-Fi', icon: 'wifi' },
  ac: { label: 'Кондиционер', icon: 'air-conditioner' },
  heating: { label: 'Отопление', icon: 'radiator' },
  tv: { label: 'TV', icon: 'television' },
  minibar: { label: 'Мини-бар', icon: 'fridge-outline' },
  safe: { label: 'Сейф', icon: 'safe' },
  balcony: { label: 'Балкон', icon: 'balcony' },
  terrace: { label: 'Терраса', icon: 'patio-heater' },
  kettle: { label: 'Чайник', icon: 'kettle' },
  hairdryer: { label: 'Фен', icon: 'hair-dryer' },
  iron: { label: 'Утюг', icon: 'iron' },
  workspace: { label: 'Раб. место', icon: 'desk' },
  fireplace: { label: 'Камин', icon: 'fireplace' },
  jacuzzi: { label: 'Джакузи', icon: 'shower' },
  kitchenette: { label: 'Кухня', icon: 'silverware-fork-knife' },
  parking: { label: 'Парковка', icon: 'parking' },
};

/**
 * Read-only summary of a RoomType. Used by reception screens to show what
 * the room actually offers — guests sometimes ask "is there a hairdryer?"
 * during check-in, and reception shouldn't have to dig through the admin
 * panel to answer.
 *
 * Photo strip is horizontal-scrollable; tapping a photo doesn't navigate
 * (intentional — this is a read-only widget, not a gallery editor).
 */
export default function RoomTypeInfoCard({ roomType: rt, compact }: Props) {
  const theme = useTheme();
  const [activePhoto, setActivePhoto] = useState(rt.coverPhoto ?? rt.photos?.[0]);

  return (
    <Card mode="outlined" style={styles.card}>
      {activePhoto ? (
        <Image source={{ uri: activePhoto }} style={styles.cover} />
      ) : (
        <View
          style={[
            styles.cover,
            styles.coverPlaceholder,
            { backgroundColor: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="labelLarge" style={{ opacity: 0.5 }}>
            Нет фото
          </Text>
        </View>
      )}

      {!compact && rt.photos && rt.photos.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbStrip}
        >
          {rt.photos.map((url, i) => {
            const isActive = url === activePhoto;
            return (
              <TouchableOpacity
                key={`${url}-${i}`}
                onPress={() => setActivePhoto(url)}
                style={[
                  styles.thumb,
                  isActive && {
                    borderColor: theme.colors.primary,
                    borderWidth: 2,
                  },
                ]}
              >
                <Image source={{ uri: url }} style={styles.thumbImg} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Card.Title
        title={rt.name}
        subtitle={`${rt.beds} кроватей · до ${rt.maxGuests} гостей · ${rt.basePrice}/сут`}
        right={(props) =>
          rt.videoUrl ? (
            <IconButton
              {...props}
              icon="video"
              onPress={() =>
                rt.videoUrl && Linking.openURL(rt.videoUrl).catch(() => {})
              }
            />
          ) : null
        }
      />
      <Card.Content>
        {rt.description && (
          <Text variant="bodyMedium" style={styles.desc}>
            {rt.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          {rt.bedConfiguration && (
            <Chip compact icon="bed">
              {rt.bedConfiguration}
            </Chip>
          )}
          {rt.sizeM2 && <Chip compact>{rt.sizeM2} m²</Chip>}
          {rt.view && <Chip compact icon="image-outline">{rt.view}</Chip>}
          {rt.breakfastIncluded && (
            <Chip compact icon="silverware-fork-knife">
              Завтрак
            </Chip>
          )}
          {rt.petsAllowed && <Chip compact icon="dog">С животными</Chip>}
          {rt.smokingAllowed && (
            <Chip compact icon="smoking">Курение</Chip>
          )}
          {rt.accessibleForDisabled && (
            <Chip compact icon="wheelchair-accessibility">Доступно МГН</Chip>
          )}
        </View>

        {rt.amenities && rt.amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {rt.amenities.map((slug) => {
              const known = AMENITY_LABELS[slug];
              return (
                <Chip
                  key={slug}
                  compact
                  icon={known?.icon ?? 'check'}
                  style={styles.amenityChip}
                >
                  {known?.label ?? slug}
                </Chip>
              );
            })}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 8, overflow: 'hidden' },
  cover: { width: '100%', height: 200 },
  coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbStrip: { padding: 8, gap: 6 },
  thumb: {
    width: 60,
    height: 45,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 6,
  },
  thumbImg: { width: '100%', height: '100%' },
  desc: { marginBottom: 12, opacity: 0.85 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityChip: { marginBottom: 4 },
});
