import { useRef } from 'react';
import { useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { loadPrimaryTabScroll, savePrimaryTabScroll, type PrimaryTabKey } from './primaryTabState';

export function usePrimaryTabScroll(key: PrimaryTabKey) {
  const contentRef = useRef<HTMLIonContentElement>(null);

  useIonViewWillEnter(() => {
    const top = loadPrimaryTabScroll(key);
    if (top <= 0) return;
    window.requestAnimationFrame(() => { void contentRef.current?.scrollToPoint(0, top, 0); });
  });

  useIonViewDidLeave(() => {
    void contentRef.current?.getScrollElement().then((element) => savePrimaryTabScroll(key, element.scrollTop));
  });

  return contentRef;
}
