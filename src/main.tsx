import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { checkDatabaseStartup } from './persistence/startup';
import { StartupFailureScreen } from './ui/screens/system/StartupFailureScreen';
import './ui/styles/tokens.css';
import './ui/styles/global.css';

async function bootstrap() {
  const state = await checkDatabaseStartup();
  const content = state.status === 'READY' ? <App/> : <StartupFailureScreen state={state}/>;
  createRoot(document.getElementById('root')!).render(<StrictMode>{content}</StrictMode>);
}

void bootstrap();
