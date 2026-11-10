import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { GPXRoute } from '../types';
import type { MapViewerProps } from './MapViewer';
const MapViewer = lazy(() => import('./MapViewer').then((module) => ({ default: module.MapViewer })));

export function LazyRouteMap({ route, loadRoute, ...props }: MapViewerProps & { loadRoute: (id: string) => Promise<GPXRoute> }) {
  const loader = useRef(loadRoute); loader.current = loadRoute;
  const [loaded, setLoaded] = useState<GPXRoute>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (route.detailsLoaded !== false) return;
    let current = true;
    setError(undefined); setLoaded(undefined);
    loader.current(route.id).then((full) => { if (current) setLoaded(full); }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'The map could not be loaded.'); });
    return () => { current = false; };
  }, [route.id, route.updatedAt, route.detailsLoaded, attempt]);
  const complete = route.detailsLoaded === false ? (loaded?.id === route.id ? loaded : undefined) : route;
  const pending = <div role="status" className="flex items-center justify-center rounded-2xl bg-stone-100 text-sm text-stone-600" style={{ height: props.height || '400px' }}>Loading route map…</div>;
  if (!complete) return error ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">{error} <button type="button" className="font-bold underline" onClick={() => setAttempt((n) => n + 1)}>Retry map</button></div> : pending;
  return <Suspense fallback={pending}><MapViewer {...props} route={complete} /></Suspense>;
}
