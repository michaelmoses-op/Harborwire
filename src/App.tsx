import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing';

const Simulator = lazy(() => import('./pages/Simulator').then((module) => ({ default: module.Simulator })));

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/simulator"
          element={
            <Suspense fallback={<div className="boot">Opening the chart…</div>}>
              <Simulator />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
