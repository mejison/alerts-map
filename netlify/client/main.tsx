import { createRoot } from 'react-dom/client';
import Home from '../../app/page';
import '../../app/globals.css';
import { initializeNativeApp } from '../../lib/native-runtime';

void initializeNativeApp().catch(() => {});

createRoot(document.getElementById('root')!).render(<Home />);
