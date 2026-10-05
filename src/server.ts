import 'dotenv/config';
import { crearApp } from './app';
const port = process.env.PORT || 3000;
crearApp().listen(port, () => console.log(`API EPSA Motor en puerto ${port}`));

