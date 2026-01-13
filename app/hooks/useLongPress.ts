'use client';

import { useRef, useCallback } from 'react';

interface UseLongPressOptions {
  onLongPress: (event: TouchEvent) => void;
  delay?: number;
  moveThreshold?: number;
}

interface LongPressHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: (event: React.TouchEvent) => void;
}

/**
 * 检测长按手势的自定义 Hook
 * 
 * @param options.onLongPress - 长按触发的回调函数
 * @param options.delay - 长按延迟时间，默认 500ms
 * @param options.moveThreshold - 移动阈值，超过则取消长按，默认 10px
 * @returns 绑定到元素的事件处理器
 */
export function useLongPress({
  onLongPress,
  delay = 500,
  moveThreshold = 10,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      longPressTriggeredRef.current = false;

      timerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        onLongPress(event.nativeEvent as TouchEvent);
      }, delay);
    },
    [onLongPress, delay]
  );

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!startPosRef.current || longPressTriggeredRef.current) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      // 移动超过阈值，取消长按
      if (deltaX > moveThreshold || deltaY > moveThreshold) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        startPosRef.current = null;
      }
    },
    [moveThreshold]
  );

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  };
}
