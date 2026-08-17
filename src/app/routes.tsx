import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../ui/layout/AppShell';
import { TodayScreen } from '../ui/screens/today/TodayScreen';
import { TrainScreen } from '../ui/screens/train/TrainScreen';
import { BodyScreen } from '../ui/screens/body/BodyScreen';
import { MoreScreen } from '../ui/screens/more/MoreScreen';
import { ResetScreen } from '../ui/screens/reset/ResetScreen';
import { HistoryScreen } from '../ui/screens/history/HistoryScreen';
import { WhyScreen } from '../ui/screens/why/WhyScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayScreen />} />
        <Route path="train" element={<TrainScreen />} />
        <Route path="body" element={<BodyScreen />} />
        <Route path="more" element={<MoreScreen />} />
        <Route path="reset" element={<ResetScreen />} />
        <Route path="history/:dayId" element={<HistoryScreen />} />
        <Route path="why/:recommendationId" element={<WhyScreen />} />
      </Route>
    </Routes>
  );
}
