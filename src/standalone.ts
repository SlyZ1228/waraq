import { useState } from 'react';
// The native bundle is launched from local resources, not installed by a service worker.
export function useRegisterSW() {
  return {needRefresh:useState(false),offlineReady:useState(false),updateServiceWorker:async (_reload?:boolean)=>{}};
}
