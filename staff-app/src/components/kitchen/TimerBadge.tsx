import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Badge } from 'react-native-paper';
import { semantic } from '../../theme/colors';

interface TimerBadgeProps {
  createdAt: string;
}

function getElapsed(createdAt: string) {
  return Math.max(0, Date.now() - new Date(createdAt).getTime());
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}м ${seconds.toString().padStart(2, '0')}с`;
}

function getTimerColor(ms: number): string {
  const minutes = ms / 60000;
  if (minutes >= 15) return semantic.error; // critical
  if (minutes >= 10) return semantic.warning; // warning
  return semantic.success; // normal
}

function TimerBadge({ createdAt }: TimerBadgeProps) {
  const [elapsed, setElapsed] = useState(() => getElapsed(createdAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsed(createdAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const color = getTimerColor(elapsed);
  const isCritical = elapsed / 60000 >= 15;

  return (
    <Badge
      style={[
        styles.badge,
        { backgroundColor: color },
        isCritical && styles.critical,
      ]}
    >
      {formatElapsed(elapsed)}
    </Badge>
  );
}

const styles = StyleSheet.create({
  badge: {
    // White on saturated red/amber/green keeps WCAG-AA contrast across all 3 states.
    color: '#FFFFFF',
    fontSize: 12,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  critical: {
    fontWeight: 'bold',
  },
});

export default React.memo(TimerBadge);
