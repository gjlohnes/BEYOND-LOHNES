import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../ui/layout/AppShell';
import { TodayScreen } from '../ui/screens/today/TodayScreen';
import { TrainScreen } from '../ui/screens/train/TrainScreen';
import { BodyScreen } from '../ui/screens/body/BodyScreen';
import { MoreScreen } from '../ui/screens/more/MoreScreen';
export function AppRoutes(){return <Routes><Route element={<AppShell/>}><Route index element={<Navigate to="/today" replace/>}/><Route path="today" element={<TodayScreen/>}/><Route path="train" element={<TrainScreen/>}/><Route path="body" element={<BodyScreen/>}/><Route path="more" element={<MoreScreen/>}/></Route></Routes>}
