import { NavLink, Outlet } from 'react-router-dom';
export function AppShell(){return <><main className="shell"><Outlet/></main><nav className="nav" aria-label="Primary"><NavLink to="/today">TODAY</NavLink><NavLink to="/train">TRAIN</NavLink><NavLink to="/body">BODY</NavLink><NavLink to="/more">MORE</NavLink></nav></>}
